import { describe, expect, it, vi } from "vitest";
import {
  cargarMonitoreo,
  cargarFichaMonitoreo,
  estadoGps,
  antiguedadGps,
  motoristaSeguimientoSchema,
  paginaSeguimientoSchema,
} from "../src/monitoreo";
import { ApiError } from "../src/errores";
import { puedeMonitorear, puedeEntrar } from "../src/permisos";
import { ejemplosSeccion, motorista, perfil } from "./fixtures";
const muestra = ejemplosSeccion("## 0.45.0 — Ubicación administrativa")[0];
const registro = muestra.resultados[0];
const signal = () => new AbortController().signal;
const respuesta = (resultados: unknown[]) => ({
  ...muestra,
  resultados,
  conteo: resultados.length,
});

describe("Monitoreo de jornada 0.45.0", () => {
  it("lee el ejemplo sin servicios y conserva GPS no operativo", async () => {
    const rutas: string[] = [];
    const datos = await cargarMonitoreo(async (ruta) => {
      rutas.push(ruta);
      return muestra;
    }, signal());
    expect(datos.registros[0].punto?.latitud).toBe(14.075);
    expect(datos.registros[0].punto?.es_operativo).toBe(false);
    expect(datos.registros[0].solicitudes_activas).toBe(0);
    expect(datos.intervalo).toBe(20);
    expect(rutas).toHaveLength(1);
    expect(rutas[0]).toContain("/seguimiento/motoristas/");
    expect(rutas[0]).not.toContain("empresa_id");
  });
  it("Corporate envía su empresa y excluye registros ajenos sin consultas GPS antiguas", async () => {
    const rutas: string[] = [];
    const datos = await cargarMonitoreo(
      async (ruta) => {
        rutas.push(ruta);
        return respuesta([
          registro,
          { ...registro, repartidor_id: "ajeno", empresa_id: "otra" },
        ]);
      },
      signal(),
      registro.empresa_id,
    );
    expect(datos.registros.map((m) => m.repartidor_id)).toEqual([
      registro.repartidor_id,
    ]);
    expect(
      new URL(rutas[0], "https://test").searchParams.get("empresa_id"),
    ).toBe(registro.empresa_id);
  });
  it("completa todas las páginas sin seguir URLs externas y no publica resultados parciales", async () => {
    const rutas: string[] = [];
    const datos = await cargarMonitoreo(async (ruta) => {
      rutas.push(ruta);
      return rutas.length === 1
        ? { ...muestra, pagina_siguiente: "https://ajeno.test/" }
        : respuesta([{ ...registro, repartidor_id: "segundo" }]);
    }, signal());
    expect(datos.registros).toHaveLength(2);
    expect(
      rutas.every((r) => r.startsWith("/api/v1/seguimiento/motoristas/")),
    ).toBe(true);
    await expect(
      cargarMonitoreo(
        async () => ({ ...muestra, pagina_siguiente: "otro" }),
        signal(),
      ),
    ).rejects.toThrow("contrato");
  });
  it("una segunda página fallida propaga el error sin entregar la primera", async () => {
    let n = 0;
    await expect(
      cargarMonitoreo(async () => {
        if (++n === 1) return { ...muestra, pagina_siguiente: "otra" };
        throw new ApiError(503, { codigo: "CIERRE_OPERATIVO_PENDIENTE" }, 5);
      }, signal()),
    ).rejects.toMatchObject({ cierrePendiente: true });
  });
  it.each([401, 403, 404, 500])(
    "HTTP %s no activa un seguimiento alternativo",
    async (status) => {
      let n = 0;
      await expect(
        cargarMonitoreo(async () => {
          n++;
          throw new ApiError(status);
        }, signal()),
      ).rejects.toMatchObject({ status });
      expect(n).toBe(1);
    },
  );
  it.each([
    "ACTUALIZADA",
    "DESACTUALIZADA",
    "SIN_PRECISION",
    "BAJA_PRECISION",
    "SIN_UBICACION",
  ])("interpreta %s con las reglas del servidor", async (estado_ubicacion) => {
    const sin = estado_ubicacion === "SIN_UBICACION";
    const m = {
      ...registro,
      estado_ubicacion,
      ubicacion_vigente: estado_ubicacion === "ACTUALIZADA",
      ubicacion: sin ? null : registro.ubicacion,
      antiguedad_segundos: sin ? null : 2,
    };
    const datos = await cargarMonitoreo(async () => respuesta([m]), signal());
    expect(estadoGps(datos.registros[0], datos.registros[0].recibidoEn)).toBe(
      {
        ACTUALIZADA: "Ubicación reciente",
        DESACTUALIZADA: "Ubicación antigua",
        SIN_PRECISION: "Precisión no informada",
        BAJA_PRECISION: "Baja precisión",
        SIN_UBICACION: "Sin ubicación disponible",
      }[estado_ubicacion],
    );
    if (sin) expect(datos.registros[0].punto).toBeNull();
  });
  it("usa edad del servidor y tiempo monotónico con umbral configurable, no la hora del equipo", async () => {
    const datos = await cargarMonitoreo(
      async () => ({
        ...muestra,
        criterios_vigencia: {
          antiguedad_maxima_segundos: 5,
          precision_maxima_metros: 20,
        },
      }),
      signal(),
    );
    const m = datos.registros[0];
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2040-01-01"));
      expect(estadoGps(m, m.recibidoEn + 2000)).toBe("Ubicación reciente");
      expect(estadoGps(m, m.recibidoEn + 4000)).toBe("Ubicación antigua");
      expect(antiguedadGps(m, m.recibidoEn + 2000)).toBe(4);
    } finally {
      vi.useRealTimers();
    }
  });
  it("rechaza datos inconsistentes y coordenadas inválidas", async () => {
    for (const cambio of [
      { ubicacion_vigente: false },
      { ubicacion: null },
      { tiene_servicios_activos: true },
      { ubicacion: { ...registro.ubicacion, latitud: "91" } },
      {
        ubicacion: {
          ...registro.ubicacion,
          registrada_en: "2026-10-29T01:00:00Z",
        },
      },
    ])
      expect(
        motoristaSeguimientoSchema.safeParse({ ...registro, ...cambio })
          .success,
      ).toBe(false);
    expect(
      paginaSeguimientoSchema.safeParse({
        ...muestra,
        intervalo_actualizacion_segundos: 0,
      }).success,
    ).toBe(false);
    await expect(
      cargarMonitoreo(
        async () =>
          respuesta([
            {
              ...registro,
              ubicacion: {
                ...registro.ubicacion,
                registrada_en: "2099-01-01T00:00:00Z",
              },
            },
          ]),
        signal(),
      ),
    ).rejects.toThrow("contrato");
  });
  it("almuerzo, espera y falta de GPS no requieren solicitudes", async () => {
    const datos = await cargarMonitoreo(
      async () =>
        respuesta([
          { ...registro, en_almuerzo: true, estado_operativo: "PAUSED" },
          {
            ...registro,
            repartidor_id: "sin-gps",
            ubicacion: null,
            estado_ubicacion: "SIN_UBICACION",
            ubicacion_vigente: false,
            antiguedad_segundos: null,
          },
        ]),
      signal(),
    );
    expect(datos.registros).toHaveLength(2);
    expect(datos.registros[0].punto).not.toBeNull();
    expect(datos.registros[1].punto).toBeNull();
  });
  it("un listado vacío retira toda la jornada y una lectura abortada no consulta", async () => {
    expect(
      (await cargarMonitoreo(async () => respuesta([]), signal())).registros,
    ).toEqual([]);
    const c = new AbortController();
    c.abort();
    let n = 0;
    await expect(
      cargarMonitoreo(async () => {
        n++;
        return muestra;
      }, c.signal),
    ).rejects.toBeDefined();
    expect(n).toBe(0);
  });
  it("la ficha no solicita permisos ajenos al seguimiento", async () => {
    const datos = await cargarMonitoreo(async () => muestra, signal());
    let n = 0;
    const ficha = await cargarFichaMonitoreo(
      async () => {
        n++;
        return {};
      },
      signal(),
      datos.registros[0],
      ["repartidor.ver_ubicacion"],
    );
    expect(n).toBe(0);
    expect(ficha.motorista).toBeUndefined();
    expect(ficha.solicitudes).toBeUndefined();
  });
  it("la ficha verifica la identidad y empresa del motorista", async () => {
    const datos = await cargarMonitoreo(
      async () =>
        respuesta([
          {
            ...registro,
            repartidor_id: motorista.id,
            usuario_id: motorista.usuario.id,
            empresa_id: motorista.empresa_id,
          },
        ]),
      signal(),
    );
    await expect(
      cargarFichaMonitoreo(
        async () => ({ ...motorista, empresa_id: "ajena" }),
        signal(),
        datos.registros[0],
        ["repartidor.ver"],
      ),
    ).rejects.toThrow("contrato");
  });
  it("requiere el permiso nuevo y alcance completo; Network solo global", () => {
    const p = { ...perfil, permisos: ["repartidor.ver_ubicacion"] };
    expect(puedeMonitorear(p)).toBe(true);
    expect(puedeEntrar(p)).toBe(true);
    expect(puedeMonitorear(perfil)).toBe(false);
    expect(
      puedeMonitorear({
        ...p,
        roles: p.roles.map((r) => ({
          ...r,
          tipo_alcance: "SUCURSAL" as const,
        })),
      }),
    ).toBe(false);
    const red = {
      ...p,
      roles: p.roles.map((r) => ({ ...r, codigo: "OPERADOR_RED" })),
    };
    expect(puedeMonitorear(red)).toBe(false);
    expect(
      puedeMonitorear({
        ...red,
        roles: red.roles.map((r) => ({
          ...r,
          tipo_alcance: "GLOBAL" as const,
        })),
      }),
    ).toBe(true);
  });
});
