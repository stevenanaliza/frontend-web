import { describe, expect, it } from "vitest";
import {
  cargarMonitoreo,
  estadoGps,
  seguimientoSchema,
  type PedirMonitoreo,
} from "../src/monitoreo";
import { ApiError } from "../src/errores";
import { ejemplosSeccion, motorista, solicitud } from "./fixtures";

const ejemplo = ejemplosSeccion(
  "### Consultar seguimiento de una solicitud",
)[0];
const activa = {
  ...solicitud,
  estado: "IN_TRANSIT",
  repartidor_asignado_id: motorista.id,
};
const gps = {
  ...ejemplo,
  solicitud_id: activa.id,
  ubicacion: { ...ejemplo.ubicacion, repartidor_id: motorista.id },
};
const pagina = (resultados: unknown[], siguiente: string | null = null) => ({
  conteo: resultados.length,
  pagina_siguiente: siguiente,
  pagina_anterior: null,
  resultados,
});
function preparar(
  opciones: { gps?: unknown; fallo?: number; motoristas?: unknown[] } = {},
) {
  const rutas: string[] = [];
  const pedir: PedirMonitoreo = async (ruta) => {
    rutas.push(ruta);
    const url = new URL(ruta, "http://api.test");
    if (url.pathname.endsWith("/repartidores/"))
      return pagina(opciones.motoristas ?? [motorista]);
    if (url.pathname.endsWith("/solicitudes/"))
      return pagina(
        url.searchParams.get("estado") === "IN_TRANSIT" ? [activa] : [],
      );
    if (url.pathname.endsWith("/seguimiento/")) {
      if (opciones.fallo)
        throw new ApiError(
          opciones.fallo,
          opciones.fallo === 503
            ? { codigo: "CIERRE_OPERATIVO_PENDIENTE" }
            : {},
          5,
        );
      return opciones.gps ?? gps;
    }
    throw new Error("Consulta no prevista");
  };
  return { pedir, rutas };
}
const signal = () => new AbortController().signal;
describe("monitoreo con GPS operativo autorizado", () => {
  it("consulta y muestra solo los motoristas de la empresa del perfil", async () => {
    const { pedir, rutas } = preparar({
      motoristas: [
        motorista,
        { ...motorista, id: "otro", empresa_id: "otra-empresa" },
      ],
    });
    const registros = await cargarMonitoreo(
      pedir,
      signal(),
      motorista.empresa_id!,
    );
    expect(registros.map((r) => r.motorista.id)).toEqual([motorista.id]);
    expect(
      rutas
        .filter((r) => {
          const path = new URL(r, "http://api.test").pathname;
          return (
            path.endsWith("/repartidores/") || path.endsWith("/solicitudes/")
          );
        })
        .every(
          (r) =>
            new URL(r, "http://api.test").searchParams.get("empresa_id") ===
            motorista.empresa_id,
        ),
    ).toBe(true);
  });
  it("agrupa la carga real y las solicitudes por motorista, sin sumar hitos", async () => {
    const { pedir, rutas } = preparar();
    const [registro] = await cargarMonitoreo(pedir, signal());
    expect(registro.motorista.tubos_en_transporte).toBe(
      motorista.tubos_en_transporte,
    );
    expect(registro.solicitudes).toHaveLength(1);
    expect(registro.punto?.latitud).toBe(Number(gps.ubicacion.latitud));
    expect(rutas.filter((r) => r.includes("/seguimiento/"))).toHaveLength(1);
    expect(rutas.every((r) => r.startsWith("/api/v1/"))).toBe(true);
  });
  it.each([
    { ...gps, seguimiento_disponible: false },
    { ...gps, estado: "DELIVERED" },
    { ...gps, ubicacion: null },
    { ...gps, ubicacion: { ...gps.ubicacion, es_operativo: false } },
  ])(
    "no representa una ubicación no disponible o finalizada",
    async (respuesta) => {
      const { pedir } = preparar({ gps: respuesta });
      expect((await cargarMonitoreo(pedir, signal()))[0].punto).toBeNull();
    },
  );
  it.each([403, 500])(
    "oculta el punto ante HTTP %s y marca el error",
    async (fallo) => {
      const { pedir } = preparar({ fallo });
      const [r] = await cargarMonitoreo(pedir, signal());
      expect(r.punto).toBeNull();
      expect(r.errorGps).toBe(true);
    },
  );
  it("tolera una solicitud que deja de ser visible entre consultas", async () => {
    const { pedir } = preparar({ fallo: 404 });
    const [r] = await cargarMonitoreo(pedir, signal());
    expect(r.punto).toBeNull();
    expect(r.errorGps).toBe(false);
  });
  it("rechaza coordenadas fuera de rango y datos de otro motorista", async () => {
    expect(
      seguimientoSchema.safeParse({
        ...gps,
        ubicacion: { ...gps.ubicacion, latitud: "91" },
      }).success,
    ).toBe(false);
    const { pedir } = preparar({
      gps: { ...gps, ubicacion: { ...gps.ubicacion, repartidor_id: "otro" } },
    });
    expect((await cargarMonitoreo(pedir, signal()))[0].punto).toBeNull();
  });
  it("propaga la pérdida de sesión", async () => {
    const { pedir } = preparar({ fallo: 401 });
    await expect(cargarMonitoreo(pedir, signal())).rejects.toMatchObject({
      status: 401,
    });
  });
  it("propaga la recuperación temporal del servidor aunque ocurra al consultar GPS", async () => {
    const { pedir } = preparar({ fallo: 503 });
    await expect(cargarMonitoreo(pedir, signal())).rejects.toMatchObject({
      status: 503,
      cierrePendiente: true,
      espera: 5,
    });
  });
  it("no consulta GPS sin motoristas ni continúa una lectura abortada", async () => {
    const { pedir, rutas } = preparar({ motoristas: [] });
    expect(await cargarMonitoreo(pedir, signal())).toEqual([]);
    expect(rutas).toHaveLength(1);
    const c = new AbortController();
    c.abort();
    await expect(cargarMonitoreo(pedir, c.signal)).rejects.toBeDefined();
  });
  it("distingue capturas recientes, antiguas y fechas futuras", () => {
    const punto = seguimientoSchema.parse(gps).ubicacion!;
    const tiempo = Date.parse(punto.registrada_en);
    expect(estadoGps(punto, tiempo + 119_000)).toBe("Ubicación reciente");
    expect(estadoGps(punto, tiempo + 121_000)).toBe("Ubicación antigua");
    expect(estadoGps(punto, tiempo - 61_000)).toBe(
      "Fecha de GPS por verificar",
    );
    expect(estadoGps(null, tiempo)).toBe("Sin ubicación disponible");
  });
  it("recorre páginas del directorio y elige un solo punto más reciente por motorista", async () => {
    const segunda = { ...activa, id: "segunda" };
    const rutas: string[] = [];
    const pedir: PedirMonitoreo = async (ruta) => {
      rutas.push(ruta);
      const url = new URL(ruta, "http://api.test");
      if (url.pathname.endsWith("/repartidores/"))
        return url.searchParams.get("pagina") === "1"
          ? pagina([motorista], "https://no-se-debe-visitar.test/")
          : pagina([{ ...motorista, id: "inactivo" }]);
      if (url.pathname.endsWith("/solicitudes/"))
        return pagina(
          url.searchParams.get("estado") === "IN_TRANSIT"
            ? [activa, segunda]
            : [],
        );
      return {
        ...gps,
        solicitud_id: url.pathname.includes("segunda") ? segunda.id : activa.id,
        ubicacion: {
          ...gps.ubicacion,
          registrada_en: url.pathname.includes("segunda")
            ? "2026-10-28T12:02:00Z"
            : "2026-10-28T12:00:00Z",
        },
      };
    };
    const datos = await cargarMonitoreo(pedir, signal());
    expect(datos).toHaveLength(2);
    expect(datos[0].punto?.registrada_en).toBe("2026-10-28T12:02:00Z");
    expect(datos[1].punto).toBeNull();
    expect(rutas.some((r) => r.startsWith("https:"))).toBe(false);
  });
});
