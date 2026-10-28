import { describe, it, expect, vi } from "vitest";
import { crearCliente, parsear } from "../src/api";
import {
  detalleSolicitudSchema,
  evidenciaSchema,
  grupoSolicitanteSchema,
  grupoSucursalSchema,
  motoristaSchema,
  rolesHistorialSchema,
  sucursalSchema,
  usuarioSchema,
} from "../src/contratos-admin";
import {
  gruposSolicitante,
  gruposSucursal,
  solicitud,
  evidencia,
  motorista,
  historialRoles,
  sucursal,
  usuario,
  perfil,
  tokens,
} from "./fixtures";
import { puedeEntrar, rutaInicial } from "../src/permisos";

describe("Contratos administrativos y archivos privados", () => {
  it("valida agrupaciones oficiales por sucursal y solicitante", () => {
    expect(
      parsear(grupoSucursalSchema, gruposSucursal.resultados[0]).total,
    ).toBe(6);
    expect(
      parsear(grupoSolicitanteSchema, gruposSolicitante.resultados[0])
        .solicitante_nombres,
    ).toBe("Ana");
  });
  it("conserva cantidades históricas y temperaturas desconocidas", () => {
    expect(
      parsear(detalleSolicitudSchema, solicitud).cantidad_tubos,
    ).toBeNull();
    expect(
      parsear(evidenciaSchema, evidencia).temperatura_contenedor_c,
    ).toBeNull();
  });
  it("valida directorios e historial de roles sin exigir permisos inventados", () => {
    expect(parsear(motoristaSchema, motorista).limite_tubos).toBe(20);
    expect(parsear(usuarioSchema, usuario).roles).toHaveLength(1);
    expect(parsear(sucursalSchema, sucursal).codigo).toBe("SPS-01");
    expect(
      parsear(rolesHistorialSchema, historialRoles).resultados[0].activo,
    ).toBe(true);
  });
  it("abre solicitudes con permiso administrativo ver y deniega permisos propios/asignados", () => {
    expect(puedeEntrar({ ...perfil, permisos: ["solicitud.ver"] })).toBe(true);
    expect(rutaInicial({ ...perfil, permisos: ["solicitud.ver"] })).toBe(
      "/solicitudes",
    );
    expect(
      puedeEntrar({
        ...perfil,
        permisos: ["solicitud.ver_propias", "solicitud.ver_asignadas"],
      }),
    ).toBe(false);
  });
  it("descarga la evidencia con Bearer, como binario y sin caché", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(tokens)))
      .mockResolvedValueOnce(
        new Response(new Uint8Array([137, 80, 78, 71]), {
          headers: { "Content-Type": "image/png" },
        }),
      );
    const cliente = crearCliente(
      "https://corporate.example.test",
      undefined,
      fetcher,
    );
    await cliente.iniciar("admin@example.test", "prueba");
    const archivo = await cliente.archivo(
      "/api/v1/solicitudes/id/evidencias/evidencia/archivo/",
    );
    expect(archivo.type).toBe("image/png");
    const opciones = fetcher.mock.calls[1][1]!;
    expect(new Headers(opciones.headers).get("Authorization")).toBe(
      "Bearer acceso-prueba",
    );
    expect(opciones.cache).toBe("no-store");
  });
  it("los permisos de catálogos operativos no conceden acceso al panel administrativo", () => {
    expect(
      puedeEntrar({
        ...perfil,
        permisos: [
          "empresa.ver",
          "sucursal.ver",
          "ubicacion.ver",
          "vehiculo.ver",
          "solicitud.crear",
          "solicitud.ver_propias",
        ],
      }),
    ).toBe(false);
    expect(
      puedeEntrar({
        ...perfil,
        permisos: ["ubicacion.aprobar", "ubicacion.ver"],
      }),
    ).toBe(true);
  });
  it("rechaza HTML o SVG como archivo de evidencia", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(tokens)))
      .mockResolvedValueOnce(
        new Response("<svg/>", {
          headers: { "Content-Type": "image/svg+xml" },
        }),
      );
    const cliente = crearCliente(
      "https://corporate.example.test",
      undefined,
      fetcher,
    );
    await cliente.iniciar("admin@example.test", "prueba");
    await expect(
      cliente.archivo("/api/v1/solicitudes/id/evidencias/e/archivo/"),
    ).rejects.toThrow("contrato");
  });
});
