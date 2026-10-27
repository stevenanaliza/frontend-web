import { z } from "zod";

const decimal = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/)
  .nullable();
const contador = z.number().int().nonnegative();
export const tokensSchema = z.object({
  token_acceso: z.string().min(1),
  token_refresco: z.string().min(1),
  expira_token_acceso_en: z.string().datetime({ offset: true }),
  expira_token_refresco_en: z.string().datetime({ offset: true }),
  sesion_id: z.string(),
});
export type Tokens = z.infer<typeof tokensSchema>;
const organizacion = z
  .object({ id: z.string(), nombre: z.string() })
  .nullable();
export const perfilSchema = z.object({
  usuario: z.object({
    id: z.string(),
    correo: z.string(),
    nombres: z.string(),
    apellidos: z.string(),
    estado: z.string(),
  }),
  empresa: organizacion,
  sucursal: organizacion,
  roles: z.array(
    z.object({
      codigo: z.string(),
      nombre: z.string(),
      tipo_alcance: z.enum(["GLOBAL", "EMPRESA", "SUCURSAL"]),
      empresa_id: z.string().nullable(),
      sucursal_id: z.string().nullable(),
    }),
  ),
  permisos: z.array(z.string()),
});
export type Perfil = z.infer<typeof perfilSchema>;
export const lecturaSchema = z.object({
  id: z.string(),
  solicitud_id: z.string(),
  numero_solicitud: z.string(),
  temperatura_contenedor_c: decimal,
  fuente_temperatura: z.string().nullable(),
  capturada_en: z.string().datetime({ offset: true }),
});
export type Lectura = z.infer<typeof lecturaSchema>;
export const resumenSchema = z.object({
  repartidor: z.object({
    id: z.string(),
    nombres: z.string(),
    apellidos: z.string(),
    activo: z.boolean(),
    empresa_id: z.string().nullable(),
    empresa_nombre: z.string().nullable(),
  }),
  fecha_operativa: z.string(),
  zona_horaria_operativa: z.string(),
  periodo: z.object({ desde: z.string(), hasta_exclusivo: z.string() }),
  generado_en: z.string(),
  solicitudes: z.object({
    asignadas: contador,
    recolectadas: contador,
    entregadas: contador,
    fallidas: contador,
    canceladas: contador,
  }),
  tubos: z.object({
    recogidos_conocidos: contador,
    entregados_conocidos: contador,
    recolecciones_sin_cantidad: contador,
    entregas_sin_cantidad: contador,
  }),
  kilometraje: z.object({
    criterio: z.literal("CIERRE_JORNADA"),
    jornadas_cerradas: contador,
    jornadas_con_medicion: contador,
    jornadas_consolidadas: contador,
    jornadas_sin_cierre_en_periodo: contador,
    kilometros_medidos: decimal,
    kilometros_consolidados: decimal,
    completo: z.boolean(),
  }),
  temperaturas: z.object({
    lecturas_registradas: contador,
    lecturas_con_temperatura: contador,
    lecturas_sin_temperatura: contador,
    minima_c: decimal,
    maxima_c: decimal,
    promedio_c: decimal,
    ultimas_lecturas: z.array(lecturaSchema),
  }),
  carga_actual: z.object({
    tubos_comprometidos: contador,
    tubos_en_transporte: contador,
    solicitudes_sin_cantidad_tubos: contador,
    solicitudes_activas: contador,
    limite_tubos: contador,
    limite_solicitudes: contador,
    tubos_reservados: contador,
    tubos_disponibles: contador,
    capacidad: z.string(),
    estado_operativo: z.string(),
    puede_recibir_solicitudes: z.boolean(),
  }),
});
export type Resumen = z.infer<typeof resumenSchema>;
export const paginaSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    conteo: contador,
    pagina_siguiente: z.string().nullable(),
    pagina_anterior: z.string().nullable(),
    resultados: z.array(item),
  });
export type Pagina<T> = {
  conteo: number;
  pagina_siguiente: string | null;
  pagina_anterior: string | null;
  resultados: T[];
};
