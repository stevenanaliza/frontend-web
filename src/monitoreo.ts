import { z } from "zod";
import { ContratoError, parsear } from "./errores";
import { paginaSchema } from "./contratos";
import {
  detalleSolicitudSchema,
  motoristaSchema,
  solicitudSchema,
} from "./contratos-admin";

export const estadosMonitoreo = [
  "ASSIGNED",
  "GOING_TO_PICKUP",
  "AT_PICKUP",
  "PICKED_UP",
  "IN_TRANSIT",
  "AT_DESTINATION",
] as const;
const decimal = (min: number, max = Number.MAX_VALUE) =>
  z
    .string()
    .regex(/^-?\d+(\.\d+)?$/)
    .transform(Number)
    .pipe(z.number().finite().min(min).max(max));
const fecha = z.string().datetime({ offset: true });
export const puntoJornadaSchema = z.object({
  latitud: decimal(-90, 90),
  longitud: decimal(-180, 180),
  precision_metros: decimal(0).nullable(),
  velocidad_metros_segundo: decimal(0).nullable(),
  rumbo_grados: decimal(0, 360).nullable(),
  registrada_en: fecha,
  recibida_en: fecha,
  es_operativo: z.boolean(),
});
export const motoristaSeguimientoSchema = z
  .object({
    repartidor_id: z.string().min(1),
    usuario_id: z.string().min(1),
    nombre: z.string().min(1),
    empresa_id: z.string().nullable(),
    jornada_id: z.string().min(1),
    fecha_operativa: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    iniciada_en: fecha,
    cierre_programado_en: fecha,
    estado_operativo: z.enum([
      "AVAILABLE",
      "ON_ROUTE",
      "PAUSED",
      "OFFLINE",
      "OUT_OF_SERVICE",
    ]),
    en_almuerzo: z.boolean(),
    solicitudes_activas: z.number().int().nonnegative(),
    tiene_servicios_activos: z.boolean(),
    ubicacion: puntoJornadaSchema.nullable(),
    estado_ubicacion: z.enum([
      "ACTUALIZADA",
      "DESACTUALIZADA",
      "SIN_PRECISION",
      "BAJA_PRECISION",
      "SIN_UBICACION",
    ]),
    ubicacion_vigente: z.boolean(),
    antiguedad_segundos: z.number().finite().nonnegative().nullable(),
  })
  .superRefine((m, ctx) => {
    if (m.ubicacion_vigente !== (m.estado_ubicacion === "ACTUALIZADA"))
      ctx.addIssue({
        code: "custom",
        path: ["ubicacion_vigente"],
        message: "Vigencia incompatible",
      });
    if (
      (m.ubicacion === null) !== (m.estado_ubicacion === "SIN_UBICACION") ||
      (m.ubicacion === null) !== (m.antiguedad_segundos === null)
    )
      ctx.addIssue({
        code: "custom",
        path: ["ubicacion"],
        message: "Ubicación incompatible",
      });
    if (m.tiene_servicios_activos !== m.solicitudes_activas > 0)
      ctx.addIssue({
        code: "custom",
        path: ["solicitudes_activas"],
        message: "Servicios incompatibles",
      });
    if (
      m.ubicacion &&
      Date.parse(m.ubicacion.registrada_en) < Date.parse(m.iniciada_en)
    )
      ctx.addIssue({
        code: "custom",
        path: ["ubicacion"],
        message: "GPS anterior a la jornada",
      });
  });
export const paginaSeguimientoSchema = paginaSchema(
  motoristaSeguimientoSchema,
).extend({
  hora_servidor: fecha,
  intervalo_actualizacion_segundos: z.number().finite().positive(),
  criterios_vigencia: z.object({
    antiguedad_maxima_segundos: z.number().finite().positive(),
    precision_maxima_metros: z.number().finite().nonnegative(),
  }),
});
export type MotoristaSeguimiento = z.infer<typeof motoristaSeguimientoSchema>;
export type PuntoMotorista = z.infer<typeof puntoJornadaSchema>;
export type MotoristaMonitor = MotoristaSeguimiento & {
  punto: PuntoMotorista | null;
  recibidoEn: number;
  antiguedadMaxima: number;
};
export type LoteMonitoreo = {
  registros: MotoristaMonitor[];
  intervalo: number;
  criterios: z.infer<typeof paginaSeguimientoSchema>["criterios_vigencia"];
  horaServidor: string;
};
export type PedirMonitoreo = (
  ruta: string,
  init: { signal: AbortSignal },
) => Promise<unknown>;

export async function cargarMonitoreo(
  pedir: PedirMonitoreo,
  signal: AbortSignal,
  empresaId?: string,
): Promise<LoteMonitoreo> {
  const registros = new Map<string, MotoristaMonitor>();
  const leidos = new Set<string>();
  let ultima: z.infer<typeof paginaSeguimientoSchema>;
  for (let pagina = 1; ; pagina++) {
    signal.throwIfAborted();
    const q = new URLSearchParams({
      pagina: String(pagina),
      tamano_pagina: "100",
    });
    // Network no admite empresa_id en este endpoint.
    if (empresaId) q.set("empresa_id", empresaId);
    const datos = parsear(
      paginaSeguimientoSchema,
      await pedir(`/api/v1/seguimiento/motoristas/?${q}`, { signal }),
    );
    const recibidoEn = performance.now();
    const previos = leidos.size;
    for (const m of datos.resultados) {
      leidos.add(m.repartidor_id);
      if (empresaId && m.empresa_id !== empresaId) continue;
      if (
        m.ubicacion_vigente &&
        (m.ubicacion?.precision_metros == null ||
          m.ubicacion.precision_metros >
            datos.criterios_vigencia.precision_maxima_metros ||
          m.antiguedad_segundos! >
            datos.criterios_vigencia.antiguedad_maxima_segundos)
      )
        throw new ContratoError(["ubicacion_vigente", "criterios_vigencia"]);
      if (
        m.ubicacion &&
        Date.parse(m.ubicacion.registrada_en) > Date.parse(datos.hora_servidor)
      )
        throw new ContratoError(["ubicacion.registrada_en"]);
      registros.set(m.repartidor_id, {
        ...m,
        punto: m.ubicacion,
        recibidoEn,
        antiguedadMaxima: datos.criterios_vigencia.antiguedad_maxima_segundos,
      });
    }
    ultima = datos;
    if (!datos.pagina_siguiente) break;
    if (leidos.size === previos) throw new ContratoError(["pagina_siguiente"]);
  }
  signal.throwIfAborted();
  return {
    registros: [...registros.values()],
    intervalo: ultima.intervalo_actualizacion_segundos,
    criterios: ultima.criterios_vigencia,
    horaServidor: ultima.hora_servidor,
  };
}
export function antiguedadGps(m: MotoristaMonitor, ahora = performance.now()) {
  return m.antiguedad_segundos === null
    ? null
    : m.antiguedad_segundos + Math.max(0, ahora - m.recibidoEn) / 1000;
}
export function estadoGps(m: MotoristaMonitor, ahora = performance.now()) {
  const edad = antiguedadGps(m, ahora);
  if (m.punto && edad !== null && edad > m.antiguedadMaxima)
    return "Ubicación antigua";
  return {
    ACTUALIZADA: "Ubicación reciente",
    DESACTUALIZADA: "Ubicación antigua",
    SIN_PRECISION: "Precisión no informada",
    BAJA_PRECISION: "Baja precisión",
    SIN_UBICACION: "Sin ubicación disponible",
  }[m.estado_ubicacion];
}

// La ficha amplía la información solo al seleccionar un motorista y con permisos independientes.
async function paginasSolicitudes(
  pedir: PedirMonitoreo,
  signal: AbortSignal,
  estado: string,
  empresaId?: string,
) {
  const items = new Map<string, z.infer<typeof solicitudSchema>>();
  for (let pagina = 1; ; pagina++) {
    signal.throwIfAborted();
    const q = new URLSearchParams({
      estado,
      pagina: String(pagina),
      tamano_pagina: "100",
    });
    if (empresaId) q.set("empresa_id", empresaId);
    const datos = parsear(
      paginaSchema(solicitudSchema),
      await pedir(`/api/v1/solicitudes/?${q}`, { signal }),
    );
    const anteriores = items.size;
    datos.resultados.forEach((s) => items.set(s.id, s));
    if (!datos.pagina_siguiente) return [...items.values()];
    if (items.size === anteriores)
      throw new ContratoError(["pagina_siguiente"]);
  }
}
async function concurrentes<T, R>(
  items: readonly T[],
  ejecutar: (item: T) => Promise<R>,
) {
  const resultados = new Array<R>(items.length);
  let indice = 0,
    fallo = false;
  await Promise.all(
    Array.from({ length: Math.min(4, items.length) }, async () => {
      while (!fallo && indice < items.length) {
        const i = indice++;
        try {
          resultados[i] = await ejecutar(items[i]);
        } catch (e) {
          fallo = true;
          throw e;
        }
      }
    }),
  );
  return resultados;
}
export async function cargarFichaMonitoreo(
  pedir: PedirMonitoreo,
  signal: AbortSignal,
  registro: MotoristaMonitor,
  permisos: string[],
  empresaId?: string,
) {
  const [motorista, solicitudes] = await Promise.all([
    permisos.includes("repartidor.ver")
      ? (async () => {
          const m = parsear(
            motoristaSchema,
            await pedir(
              `/api/v1/repartidores/${encodeURIComponent(registro.repartidor_id)}/`,
              { signal },
            ),
          );
          if (
            m.id !== registro.repartidor_id ||
            m.empresa_id !== registro.empresa_id ||
            m.usuario.id !== registro.usuario_id
          )
            throw new ContratoError([
              "repartidor_id",
              "empresa_id",
              "usuario_id",
            ]);
          return m;
        })()
      : undefined,
    permisos.includes("solicitud.ver") && registro.tiene_servicios_activos
      ? (async () => {
          const listas = await concurrentes(estadosMonitoreo, (estado) =>
            paginasSolicitudes(pedir, signal, estado, empresaId),
          );
          const propias = [
            ...new Map(
              listas
                .flat()
                .filter(
                  (s) =>
                    s.repartidor_asignado_id === registro.repartidor_id &&
                    (!empresaId || s.empresa_id === empresaId),
                )
                .map((s) => [s.id, s]),
            ).values(),
          ];
          return concurrentes(propias, async (s) => {
            const detalle = parsear(
              detalleSolicitudSchema,
              await pedir(`/api/v1/solicitudes/${encodeURIComponent(s.id)}/`, {
                signal,
              }),
            );
            if (
              detalle.id !== s.id ||
              detalle.repartidor_asignado_id !== registro.repartidor_id ||
              detalle.empresa_id !== s.empresa_id
            )
              throw new ContratoError(["repartidor_asignado_id"]);
            return detalle;
          });
        })()
      : undefined,
  ]);
  return { motorista, solicitudes };
}
