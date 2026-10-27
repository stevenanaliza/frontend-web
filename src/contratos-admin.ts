import { z } from "zod";
import { perfilSchema, resumenSchema } from "./contratos";

const contador = z.number().int().nonnegative();
const decimal = z.string().nullable();
const nombreId = z.object({ id: z.string(), nombre: z.string() });
const persona = z.object({
  id: z.string(),
  nombres: z.string(),
  apellidos: z.string(),
});
const ubicacion = nombreId.extend({
  direccion: z.string(),
  latitud: decimal,
  longitud: decimal,
});
export const empresaSchema = nombreId.extend({ estado: z.string() });
export const rolAsignableSchema = z.object({
  codigo: z.string(),
  nombre: z.string(),
  descripcion: z.string(),
  permite_alcance_global: z.boolean(),
  permite_alcance_empresa: z.boolean(),
  permite_alcance_sucursal: z.boolean(),
});
export const rolesAsignablesSchema = z.object({
  resultados: z.array(rolAsignableSchema),
});
export const vehiculoSchema = z.object({
  id: z.string(),
  empresa_id: z.string().nullable(),
  placa: z.string(),
  tipo: z.string(),
  marca: z.string().nullable(),
  modelo: z.string().nullable(),
  anio: z.number().int().nullable(),
  estado: z.string(),
});
export const ubicacionEmpresaSchema = z.object({
  id: z.string(),
  empresa_id: z.string(),
  estado: z.string(),
  permite_origen: z.boolean(),
  permite_destino: z.boolean(),
  ubicacion: ubicacion.extend({ estado: z.string() }),
});
export const sucursalSchema = nombreId.extend({
  empresa_id: z.string(),
  codigo: z.string(),
  telefono: z.string().nullable(),
  correo: z.string().nullable(),
  estado: z.string(),
  ubicacion: ubicacion,
});
export const usuarioSchema = persona.extend({
  correo: z.string(),
  telefono: z.string().nullable(),
  empresa_id: z.string().nullable(),
  sucursal_id: z.string().nullable(),
  estado: z.string(),
  roles: perfilSchema.shape.roles,
  creado_en: z.string(),
});
export const rolesHistorialSchema = z.object({
  resultados: z.array(
    z.object({
      id: z.string(),
      rol: z.object({
        codigo: z.string(),
        nombre: z.string(),
        descripcion: z.string(),
      }),
      tipo_alcance: z.string(),
      empresa_id: z.string().nullable(),
      sucursal_id: z.string().nullable(),
      activo: z.boolean(),
      asignado_por_id: z.string().nullable(),
      asignado_en: z.string(),
      revocado_por_id: z.string().nullable(),
      revocado_en: z.string().nullable(),
    }),
  ),
});
export const motoristaSchema = resumenSchema.shape.carga_actual.extend({
  id: z.string(),
  usuario: persona.extend({
    correo: z.string(),
    telefono: z.string().nullable(),
    estado: z.string(),
  }),
  empresa_id: z.string().nullable(),
  vehiculo: z
    .object({
      id: z.string(),
      placa: z.string(),
      tipo: z.string(),
      estado: z.string(),
    })
    .nullable(),
  activo: z.boolean(),
});
export type Motorista = z.infer<typeof motoristaSchema>;
export const grupoSucursalSchema = z.object({
  empresa_id: z.string(),
  empresa_nombre: z.string(),
  sucursal_id: z.string().nullable(),
  sucursal_nombre: z.string().nullable(),
  total: contador,
});
export const grupoSolicitanteSchema = z.object({
  empresa_id: z.string(),
  empresa_nombre: z.string(),
  solicitada_por_id: z.string(),
  solicitante_nombres: z.string(),
  solicitante_apellidos: z.string(),
  total: contador,
});
export type GrupoSolicitud =
  z.infer<typeof grupoSucursalSchema> | z.infer<typeof grupoSolicitanteSchema>;
export const solicitudSchema = z.object({
  id: z.string(),
  numero: z.string(),
  empresa_id: z.string(),
  sucursal_id: z.string().nullable(),
  sucursal: nombreId.nullable(),
  solicitada_por_id: z.string(),
  solicitante: persona,
  repartidor_asignado_id: z.string().nullable(),
  prioridad: z.string(),
  modalidad: z.string(),
  estado: z.string(),
  cantidad_tubos: contador.nullable(),
  tipo_servicio: nombreId.extend({ codigo: z.string() }),
  origen: ubicacion,
  destino: ubicacion.nullable(),
  destino_especial: z.string().nullable(),
  creado_en: z.string(),
});
export const detalleSolicitudSchema = solicitudSchema.extend({
  notas: z.string().nullable(),
  articulos: z.array(
    z.object({
      id: z.string(),
      tipo_articulo: z.string(),
      descripcion: z.string().nullable(),
      cantidad: z.string(),
      codigo_referencia: z.string().nullable(),
      condicion_transporte: z.string().nullable(),
      notas: z.string().nullable(),
    }),
  ),
  eventos: z.array(
    z.object({
      id: z.string(),
      tipo: z.string(),
      realizado_por_id: z.string().nullable(),
      repartidor_id: z.string().nullable(),
      creado_en: z.string(),
    }),
  ),
  asignada_en: z.string().nullable(),
  recolectada_en: z.string().nullable(),
  entregada_en: z.string().nullable(),
});
export const evidenciaSchema = z.object({
  id: z.string(),
  solicitud_id: z.string(),
  repartidor_id: z.string().nullable(),
  tipo: z.string(),
  tipo_contenido: z.string(),
  tamano_bytes: contador,
  latitud: decimal,
  longitud: decimal,
  capturada_en: z.string(),
  notas: z.string().nullable(),
  archivo_disponible: z.boolean(),
  temperatura_contenedor_c: decimal,
  fuente_temperatura: z.string().nullable(),
});
export type Evidencia = z.infer<typeof evidenciaSchema>;
export const estadosSolicitud: Record<string, string> = {
  PENDING: "Pendiente",
  ASSIGNED: "Asignada",
  GOING_TO_PICKUP: "Hacia recolección",
  AT_PICKUP: "En recolección",
  PICKED_UP: "Recogida",
  IN_TRANSIT: "En tránsito",
  AT_DESTINATION: "En destino",
  DELIVERED: "Entregada",
  PICKUP_FAILED: "Recolección fallida",
  DELIVERY_FAILED: "Entrega fallida",
  CANCELLED: "Cancelada",
};
