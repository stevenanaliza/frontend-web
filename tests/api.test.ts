import { describe, expect, it, vi } from "vitest";
import { ApiError, crearCliente, consulta } from "../src/api";
import { tokens } from "./fixtures";
const origen = "https://corporate.example.test";
const json = (datos: unknown, status = 200, headers = {}) =>
  new Response(JSON.stringify(datos), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
const memoria = () => {
  const datos = new Map<string, string>();
  return {
    getItem: (key: string) => datos.get(key) ?? null,
    setItem: (key: string, value: string) => {
      datos.set(key, value);
    },
    removeItem: (key: string) => {
      datos.delete(key);
    },
  };
};
describe("Cliente de API y sesión", () => {
  it("consulta directamente Django con Bearer, sin cookies, y recupera el JWT al recargar", async () => {
    const storage = memoria();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(tokens))
      .mockResolvedValueOnce(json({ ok: true }));
    await crearCliente(origen, storage, fetcher).iniciar(
      "admin@example.test",
      "prueba",
    );
    const recargado = crearCliente(origen, storage, fetcher);
    expect(recargado.tieneSesion()).toBe(true);
    await recargado.solicitar("/api/v1/usuarios/mi-perfil/");
    expect(fetcher.mock.calls[1][0]).toBe(
      `${origen}/api/v1/usuarios/mi-perfil/`,
    );
    expect(
      fetcher.mock.calls.every(([, init]) => init?.credentials === "omit"),
    ).toBe(true);
    expect(
      new Headers(fetcher.mock.calls[1][1]?.headers).get("Authorization"),
    ).toBe("Bearer acceso-prueba");
    expect(
      new Headers(fetcher.mock.calls[0][1]?.headers).has("Authorization"),
    ).toBe(false);
  });
  it("funciona en memoria si el navegador bloquea el almacenamiento", async () => {
    const storage = {
      getItem: () => {
        throw Error();
      },
      setItem: () => {
        throw Error();
      },
      removeItem: () => {
        throw Error();
      },
    };
    const cliente = crearCliente(
      origen,
      storage,
      vi.fn<typeof fetch>().mockResolvedValue(json(tokens)),
    );
    await cliente.iniciar("admin@example.test", "prueba");
    expect(cliente.tieneSesion()).toBe(true);
    cliente.limpiar();
    expect(cliente.tieneSesion()).toBe(false);
  });
  it("descarta credenciales almacenadas que no cumplen el contrato", () => {
    const storage = memoria();
    storage.setItem(
      `vitago:corporate:${origen}:sesion`,
      JSON.stringify({ token_acceso: "incompleto" }),
    );
    expect(crearCliente(origen, storage).tieneSesion()).toBe(false);
    expect(storage.getItem(`vitago:corporate:${origen}:sesion`)).toBeNull();
  });
  it("una renovación antigua no borra una sesión iniciada mientras estaba pendiente", async () => {
    let responder!: (response: Response) => void;
    const nuevos = {
      ...tokens,
      token_acceso: "otra-cuenta",
      token_refresco: "otro-refresco",
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        json({ ...tokens, expira_token_acceso_en: "2000-01-01T00:00:00Z" }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            responder = resolve;
          }),
      )
      .mockResolvedValueOnce(json(nuevos));
    const storage = memoria();
    const cliente = crearCliente(origen, storage, fetcher);
    await cliente.iniciar("primera@example.test", "prueba");
    const pendiente = cliente.solicitar("/api/v1/usuarios/mi-perfil/");
    await cliente.iniciar("segunda@example.test", "prueba");
    responder(json({}, 401));
    await expect(pendiente).rejects.toMatchObject({ status: 401 });
    expect(cliente.tieneSesion()).toBe(true);
    expect(
      JSON.parse(storage.getItem(`vitago:corporate:${origen}:sesion`)!),
    ).toEqual(nuevos);
  });
  it("una renovación pendiente no recupera la sesión después de salir localmente", async () => {
    let responder!: (response: Response) => void;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        json({ ...tokens, expira_token_acceso_en: "2000-01-01T00:00:00Z" }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            responder = resolve;
          }),
      );
    const storage = memoria();
    const cliente = crearCliente(origen, storage, fetcher);
    await cliente.iniciar("admin@example.test", "prueba");
    const pendiente = cliente.solicitar("/api/v1/usuarios/mi-perfil/");
    cliente.limpiar();
    responder(json(tokens));
    await expect(pendiente).rejects.toMatchObject({ status: 401 });
    expect(cliente.tieneSesion()).toBe(false);
    expect(storage.getItem(`vitago:corporate:${origen}:sesion`)).toBeNull();
  });
  it("descarta respuestas privadas de una sesión que terminó mientras se consultaba", async () => {
    let responder!: (response: Response) => void;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(tokens))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            responder = resolve;
          }),
      );
    const cliente = crearCliente(origen, memoria(), fetcher);
    await cliente.iniciar("admin@example.test", "prueba");
    const pendiente = cliente.solicitar("/api/v1/usuarios/mi-perfil/");
    cliente.limpiar();
    responder(json({ datos: "de la sesión anterior" }));
    await expect(pendiente).rejects.toMatchObject({ status: 401 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("no repite operaciones tras una desconexión y permite salir localmente", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(tokens))
      .mockRejectedValueOnce(new TypeError("sin red"));
    const storage = memoria();
    const cliente = crearCliente(origen, storage, fetcher);
    await cliente.iniciar("admin@example.test", "prueba");
    await expect(
      cliente.solicitar("/api/v1/accion/", { method: "POST", body: "{}" }),
    ).rejects.toMatchObject({ status: 0 });
    expect(fetcher).toHaveBeenCalledTimes(2);
    cliente.limpiar();
    expect(storage.getItem(`vitago:corporate:${origen}:sesion`)).toBeNull();
  });
  it("el proxy local conserva la ruta, el Bearer y la separación de sesión por backend", async () => {
    const storage = memoria();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(tokens))
      .mockResolvedValueOnce(json({ ok: true }));
    const cliente = crearCliente(origen, storage, fetcher, true);
    await cliente.iniciar("admin@example.test", "prueba");
    await cliente.solicitar("/api/v1/repartidores/resumenes/?pagina=2");
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "/api/v1/autenticacion/iniciar-sesion/",
      "/api/v1/repartidores/resumenes/?pagina=2",
    ]);
    expect(
      new Headers(fetcher.mock.calls[1][1]?.headers).get("Authorization"),
    ).toBe("Bearer acceso-prueba");
    expect(
      JSON.parse(storage.getItem(`vitago:corporate:${origen}:sesion`)!),
    ).toEqual(tokens);
  });
  it("envía el contrato de login y guarda el par conjuntamente, separado por backend", async () => {
    const storage = memoria();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(tokens));
    const cliente = crearCliente(origen, storage, fetcher);
    await cliente.iniciar("admin@example.test", "prueba");
    expect(fetcher).toHaveBeenCalledOnce();
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      correo: "admin@example.test",
      contrasena: "prueba",
    });
    expect(
      JSON.parse(storage.getItem(`vitago:corporate:${origen}:sesion`)!),
    ).toEqual(tokens);
    expect(
      crearCliente("https://otro.example.test", storage, fetcher).tieneSesion(),
    ).toBe(false);
  });
  it("coordina GET concurrentes con una sola renovación y usa el token rotado", async () => {
    let renovaciones = 0;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async (url, init) => {
        if (String(url).endsWith("iniciar-sesion/")) return json(tokens);
        if (String(url).endsWith("renovar/")) {
          renovaciones++;
          await new Promise((resolve) => setTimeout(resolve, 20));
          return json({
            ...tokens,
            token_acceso: "nuevo",
            token_refresco: "nuevo-refresco",
          });
        }
        return new Headers(init?.headers).get("Authorization") ===
          "Bearer nuevo"
          ? json({ ok: true })
          : json({ detail: "Token expirado" }, 401);
      });
    const storage = memoria();
    const cliente = crearCliente(origen, storage, fetcher);
    await cliente.iniciar("a@b.test", "p");
    const resultados = await Promise.all([
      cliente.solicitar("/api/v1/a/"),
      cliente.solicitar("/api/v1/b/"),
    ]);
    expect(renovaciones).toBe(1);
    expect(resultados).toEqual([{ ok: true }, { ok: true }]);
    expect(
      JSON.parse(storage.getItem(`vitago:corporate:${origen}:sesion`)!)
        .token_refresco,
    ).toBe("nuevo-refresco");
  });
  it("no repite una mutación tras un 401", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(tokens))
      .mockResolvedValue(json({}, 401));
    const cliente = crearCliente(origen, memoria(), fetcher);
    await cliente.iniciar("a@b.test", "p");
    await expect(
      cliente.solicitar("/api/v1/accion/", { method: "POST", body: "{}" }),
    ).rejects.toMatchObject({ status: 401 });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(cliente.tieneSesion()).toBe(false);
  });
  it("detiene la renovación cuando el GET repetido sigue sin autorización", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(tokens))
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({ ...tokens, token_acceso: "nuevo" }))
      .mockResolvedValue(json({}, 401));
    const cliente = crearCliente(origen, memoria(), fetcher);
    await cliente.iniciar("a@b.test", "p");
    await expect(cliente.solicitar("/api/v1/a/")).rejects.toMatchObject({
      status: 401,
    });
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(cliente.tieneSesion()).toBe(false);
  });
  it("usa las expiraciones documentadas y no renueva dos veces la misma petición", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        json({ ...tokens, expira_token_acceso_en: "2000-01-01T00:00:00Z" }),
      )
      .mockResolvedValueOnce(json(tokens))
      .mockResolvedValueOnce(json({}, 401));
    const cliente = crearCliente(origen, memoria(), fetcher);
    await cliente.iniciar("a@b.test", "p");
    await expect(cliente.solicitar("/api/v1/a/")).rejects.toMatchObject({
      status: 401,
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("elimina credenciales si falla la renovación, incluso por desconexión", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(tokens))
      .mockResolvedValueOnce(json({}, 401))
      .mockRejectedValueOnce(new TypeError("sin red"));
    const cliente = crearCliente(origen, memoria(), fetcher);
    const perder = vi.fn();
    cliente.escucharSesion(perder);
    await cliente.iniciar("a@b.test", "p");
    await expect(cliente.solicitar("/api/v1/a/")).rejects.toMatchObject({
      status: 0,
    });
    expect(perder).toHaveBeenCalledOnce();
    expect(cliente.tieneSesion()).toBe(false);
  });
  it.each([400, 403, 404, 409, 500])(
    "conserva HTTP %s sin renovar ni reintentar",
    async (status) => {
      const campos = {
        limite_tubos: ["No puede ser menor que la carga actual."],
      };
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(json(tokens))
        .mockResolvedValueOnce(json(campos, status));
      const cliente = crearCliente(origen, memoria(), fetcher);
      await cliente.iniciar("a@b.test", "p");
      await expect(cliente.solicitar("/api/v1/a/")).rejects.toMatchObject({
        status,
        campos,
      });
      expect(fetcher).toHaveBeenCalledTimes(2);
    },
  );
  it("respeta 429 y conserva la espera del backend", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      json({ detail: "Espera", segundos_espera: 7 }, 429, {
        "Retry-After": "9",
      }),
    );
    await expect(
      crearCliente(origen, memoria(), fetcher).iniciar("a@b.test", "p"),
    ).rejects.toMatchObject({ status: 429, espera: 9 });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("limpia la sesión tras el cierre 204", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(tokens))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const cliente = crearCliente(origen, memoria(), fetcher);
    await cliente.iniciar("a@b.test", "p");
    await cliente.cerrar();
    expect(cliente.tieneSesion()).toBe(false);
  });
  it("bloquea URLs ajenas y redirecciones para no filtrar tokens", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(tokens));
    const cliente = crearCliente(origen, memoria(), fetcher);
    await cliente.iniciar("a@b.test", "p");
    await expect(
      cliente.solicitar("https://ajeno.test/api/v1/a/"),
    ).rejects.toThrow("Ruta");
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][1]?.redirect).toBe("error");
    expect(() => crearCliente("https://u:secreto@example.test")).toThrow();
  });
  it("no expone detalles técnicos de errores 500", () => {
    expect(
      new ApiError(500, { detail: "secreto técnico" }).message,
    ).not.toContain("secreto");
  });
  it("solo envía filtros declarados y omite vacíos sin agregar el solicitante", () => {
    expect(
      consulta({ fecha_operativa: "2026-10-27", empresa_id: "", pagina: 2 }),
    ).toBe("?fecha_operativa=2026-10-27&pagina=2");
  });
});
