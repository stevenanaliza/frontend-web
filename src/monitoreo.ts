import { z } from "zod";
import { ApiError, parsear } from "./errores";
import { paginaSchema } from "./contratos";
import {
  motoristaSchema,
  solicitudSchema,
  type Motorista,
} from "./contratos-admin";

export const estadosMonitoreo = [
  "ASSIGNED",
  "GOING_TO_PICKUP",
  "AT_PICKUP",
  "PICKED_UP",
  "IN_TRANSIT",
  "AT_DESTINATION",
] as const;
const coordenada = (min: number, max: number) =>
  z
    .string()
    .regex(/^-?\d+(\.\d+)?$/)
    .transform(Number)
    .pipe(z.number().finite().min(min).max(max));
export const seguimientoSchema = z.object({
  solicitud_id: z.string(),
  estado: z.string(),
  seguimiento_disponible: z.boolean(),
  ubicacion: z
    .object({
      repartidor_id: z.string(),
      latitud: coordenada(-90, 90),
      longitud: coordenada(-180, 180),
      precision_metros: z
        .string()
        .regex(/^\d+(\.\d+)?$/)
        .nullable(),
      registrada_en: z.string().datetime({ offset: true }),
      es_operativo: z.boolean(),
    })
    .nullable(),
});
export type PuntoMotorista = NonNullable<
  z.infer<typeof seguimientoSchema>["ubicacion"]
>;
export type SolicitudMonitor = z.infer<typeof solicitudSchema>;
export type MotoristaMonitor = {
  motorista: Motorista;
  solicitudes: SolicitudMonitor[];
  punto: PuntoMotorista | null;
  errorGps: boolean;
};
export type PedirMonitoreo = (
  ruta: string,
  init: { signal: AbortSignal },
) => Promise<unknown>;

// Leer todas las páginas del alcance autorizado; nunca seguir URLs externas del paginador.
async function paginas<T extends { id: string }>(
  pedir: PedirMonitoreo,
  ruta: string,
  schema: z.ZodType<T>,
  signal: AbortSignal,
  estado?: string,
  empresaId?: string,
) {
  const registros = new Map<string, T>();
  for (let pagina = 1; ; pagina++) {
    signal.throwIfAborted();
    const filtros = new URLSearchParams({
      pagina: String(pagina),
      tamano_pagina: "100",
    });
    if (estado) filtros.set("estado", estado);
    if (empresaId) filtros.set("empresa_id", empresaId);
    const datos = parsear(
      paginaSchema(schema),
      await pedir(`${ruta}?${filtros}`, { signal }),
    );
    const anteriores = registros.size;
    datos.resultados.forEach((r) => registros.set(r.id, r));
    if (!datos.pagina_siguiente) return [...registros.values()];
    if (registros.size === anteriores)
      throw new Error("La paginación no avanza.");
  }
}

async function concurrentes<T, R>(
  items: T[],
  ejecutar: (item: T) => Promise<R>,
) {
  const resultados = new Array<R>(items.length);
  let indice = 0;
  let fallo = false;
  await Promise.all(
    Array.from({ length: Math.min(4, items.length) }, async () => {
      while (!fallo && indice < items.length) {
        const actual = indice++;
        try {
          resultados[actual] = await ejecutar(items[actual]);
        } catch (error) {
          fallo = true;
          throw error;
        }
      }
    }),
  );
  return resultados;
}

export async function cargarMonitoreo(
  pedir: PedirMonitoreo,
  signal: AbortSignal,
  empresaId?: string,
): Promise<MotoristaMonitor[]> {
  const motoristas = (
    await paginas(
      pedir,
      "/api/v1/repartidores/",
      motoristaSchema,
      signal,
      undefined,
      empresaId,
    )
  ).filter((m) => !empresaId || m.empresa_id === empresaId);
  if (!motoristas.length) return [];
  const lotes = await concurrentes([...estadosMonitoreo], (estado) =>
    paginas(
      pedir,
      "/api/v1/solicitudes/",
      solicitudSchema,
      signal,
      estado,
      empresaId,
    ),
  );
  const ids = new Set(motoristas.map((m) => m.id));
  const solicitudes = [
    ...new Map(
      lotes
        .flat()
        .filter(
          (s) =>
            (!empresaId || s.empresa_id === empresaId) &&
            s.repartidor_asignado_id &&
            ids.has(s.repartidor_asignado_id),
        )
        .map((s) => [s.id, s]),
    ).values(),
  ];
  const puntos = await concurrentes(solicitudes, async (solicitud) => {
    try {
      const datos = parsear(
        seguimientoSchema,
        await pedir(
          `/api/v1/solicitudes/${encodeURIComponent(solicitud.id)}/seguimiento/`,
          { signal },
        ),
      );
      if (
        datos.solicitud_id !== solicitud.id ||
        (datos.ubicacion &&
          datos.ubicacion.repartidor_id !== solicitud.repartidor_asignado_id)
      )
        throw new Error("Seguimiento incompatible con la solicitud.");
      const punto =
        datos.seguimiento_disponible &&
        estadosMonitoreo.some((e) => e === datos.estado) &&
        datos.ubicacion?.es_operativo
          ? datos.ubicacion
          : null;
      return { solicitud, punto, error: false };
    } catch (error) {
      signal.throwIfAborted();
      if (
        error instanceof ApiError &&
        (error.status === 401 || error.cierrePendiente)
      )
        throw error;
      // Una solicitud puede terminar o desaparecer del alcance entre las dos consultas.
      return {
        solicitud,
        punto: null,
        error: !(error instanceof ApiError && error.status === 404),
      };
    }
  });
  return motoristas.map((motorista) => {
    const propias = puntos.filter(
      (p) => p.solicitud.repartidor_asignado_id === motorista.id,
    );
    const errorGps = propias.some((p) => p.error);
    const vigentes = propias
      .flatMap((p) => (p.punto ? [p.punto] : []))
      .sort(
        (a, b) => Date.parse(b.registrada_en) - Date.parse(a.registrada_en),
      );
    return {
      motorista,
      solicitudes: propias.map((p) => p.solicitud),
      punto: errorGps ? null : (vigentes[0] ?? null),
      errorGps,
    };
  });
}

export function estadoGps(punto: PuntoMotorista | null, ahora = Date.now()) {
  if (!punto) return "Sin ubicación disponible";
  const edad = ahora - Date.parse(punto.registrada_en);
  if (edad < -60_000) return "Fecha de GPS por verificar";
  return edad <= 120_000 ? "Ubicación reciente" : "Ubicación antigua";
}
