import { describe, expect, it, vi } from "vitest";
import { cantidad, validarCarga } from "../src/carga";
import {
  detalleSolicitudSchema,
  motoristaSchema,
} from "../src/contratos-admin";
import { resumenSchema } from "../src/contratos";
import { limitesMotoristasSchema } from "../src/limites-motoristas";
import { ApiError, crearCliente } from "../src/api";
import { motorista, resumen, solicitud, tokens } from "./fixtures";

describe("Carga independiente 0.44.0", () => {
  it("no limita los acumulados diarios al máximo permitido para una solicitud", () => {
    const frascos = {
      recogidos_conocidos: 3000000000,
      entregados_conocidos: 3000000000,
      recolecciones_sin_cantidad: 0,
      entregas_sin_cantidad: 0,
    };
    expect(resumenSchema.parse({ ...resumen, frascos }).frascos).toEqual(
      frascos,
    );
  });
  it.each([
    [0, 3],
    [8, 0],
    [8, 3],
    [2147483647, 2147483647],
  ])("acepta tubos=%s y frascos=%s", (t, f) => {
    expect(validarCarga(t, f)).toEqual({
      cantidad_tubos: t,
      cantidad_frascos: f,
    });
  });
  it("rechaza carga vacía y valores negativos, fraccionarios, booleanos o fuera de rango por campo", () => {
    expect(() => validarCarga(0, 0)).toThrow(ApiError);
    for (const valor of [-1, 0.5, 2147483648, true, "3", NaN, null]) {
      for (const campo of ["cantidad_tubos", "cantidad_frascos"]) {
        try {
          validarCarga(
            campo === "cantidad_tubos" ? valor : 1,
            campo === "cantidad_frascos" ? valor : 1,
          );
          expect.fail("Debía rechazar la cantidad");
        } catch (e) {
          expect((e as ApiError).campos).toHaveProperty(campo);
        }
      }
    }
  });
  it("distingue null, ausencia y cero sin convertir artículos históricos en frascos", () => {
    const historicos = [
      {
        id: "historia",
        tipo_articulo: "Muestra",
        descripcion: null,
        cantidad: "8.5",
        codigo_referencia: null,
        condicion_transporte: null,
        notas: null,
      },
    ];
    const nuevo = detalleSolicitudSchema.parse({
      ...solicitud,
      articulos_historicos: historicos,
    });
    expect(nuevo.cantidad_frascos).toBeNull();
    expect(nuevo.articulos_historicos).toEqual(historicos);
    expect(
      detalleSolicitudSchema.parse({
        ...solicitud,
        cantidad_frascos: 0,
        articulos_historicos: [],
      }).cantidad_frascos,
    ).toBe(0);
    expect(
      detalleSolicitudSchema.parse({
        ...solicitud,
        cantidad_frascos: undefined,
      }).cantidad_frascos,
    ).toBeUndefined();
    expect(cantidad(null)).toBe("No registrado");
    expect(cantidad(undefined)).toBe("No registrado");
    expect(cantidad(0)).toBe("0");
  });
  it("conserva las cargas y resúmenes publicados sin calcular cupos en el cliente", () => {
    const frascos = {
      recogidos_conocidos: 9,
      entregados_conocidos: 7,
      recolecciones_sin_cantidad: 2,
      entregas_sin_cantidad: 1,
    };
    expect(resumenSchema.parse({ ...resumen, frascos }).frascos).toEqual(
      frascos,
    );
    expect(resumenSchema.parse(resumen).frascos).toBeUndefined();
    expect(motoristaSchema.parse(motorista).frascos_disponibles).toBe(11);
    expect(
      motoristaSchema.safeParse({ ...motorista, frascos_disponibles: -1 })
        .success,
    ).toBe(false);
  });
  it("valida el límite de frascos en empresa y red sin imponer un valor por omisión", () => {
    for (const alcance of ["EMPRESA", "RED"]) {
      const datos = {
        alcance,
        empresa_id: "empresa",
        limite_tubos: 20,
        limite_solicitudes: 5,
      };
      expect(
        limitesMotoristasSchema.parse(datos).limite_frascos,
      ).toBeUndefined();
      expect(
        limitesMotoristasSchema.parse({ ...datos, limite_frascos: 12 })
          .limite_frascos,
      ).toBe(12);
      for (const limite_frascos of [0, -1, 1.5, true, 2147483648])
        expect(
          limitesMotoristasSchema.safeParse({ ...datos, limite_frascos })
            .success,
        ).toBe(false);
    }
  });
});

describe("Recuperación temporal 0.43.0", () => {
  it("respeta Retry-After y no repite escrituras ni pierde la sesión", async () => {
    let ahora = 1000;
    const reloj = vi.spyOn(performance, "now").mockImplementation(() => ahora);
    try {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json(tokens))
        .mockResolvedValueOnce(
          Response.json(
            {
              codigo: "CIERRE_OPERATIVO_PENDIENTE",
              detail: "texto interno ignorado",
            },
            { status: 503, headers: { "Retry-After": "5" } },
          ),
        )
        .mockResolvedValueOnce(Response.json({ ok: true }));
      const api = crearCliente("https://prueba.test", undefined, fetcher);
      await api.iniciar("prueba@example.test", "prueba");
      const init = {
        method: "PATCH",
        body: JSON.stringify({ cantidad_frascos: 2, motivo: "Conteo" }),
      };
      await expect(
        api.solicitar("/api/v1/solicitudes/1/carga/", init),
      ).rejects.toMatchObject({
        status: 503,
        cierrePendiente: true,
        espera: 5,
      });
      ahora += 4999;
      await expect(
        api.solicitar("/api/v1/usuarios/mi-perfil/"),
      ).rejects.toThrow("recuperando el cierre operativo");
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(api.tieneSesion()).toBe(true);
      ahora += 1;
      await expect(
        api.solicitar("/api/v1/usuarios/mi-perfil/"),
      ).resolves.toEqual({ ok: true });
      expect(
        fetcher.mock.calls.filter(([, init]) => init?.method === "PATCH"),
      ).toHaveLength(1);
    } finally {
      reloj.mockRestore();
    }
  });
  it("un 503 durante renovación conserva los tokens para intentarlo después", async () => {
    let ahora = 1000;
    const reloj = vi.spyOn(performance, "now").mockImplementation(() => ahora);
    try {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          Response.json({
            ...tokens,
            expira_token_acceso_en: "2000-01-01T00:00:00Z",
          }),
        )
        .mockResolvedValueOnce(
          Response.json(
            { codigo: "CIERRE_OPERATIVO_PENDIENTE" },
            { status: 503 },
          ),
        )
        .mockResolvedValueOnce(Response.json(tokens))
        .mockResolvedValueOnce(Response.json({ ok: true }));
      const api = crearCliente("https://prueba.test", undefined, fetcher);
      await api.iniciar("prueba@example.test", "prueba");
      await expect(
        api.solicitar("/api/v1/usuarios/mi-perfil/"),
      ).rejects.toMatchObject({ espera: 5 });
      expect(api.tieneSesion()).toBe(true);
      ahora += 5000;
      await expect(
        api.solicitar("/api/v1/usuarios/mi-perfil/"),
      ).resolves.toEqual({ ok: true });
    } finally {
      reloj.mockRestore();
    }
  });
});
