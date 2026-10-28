import { z } from "zod";
import { empresaSchema, ubicacionEmpresaSchema } from "./contratos-admin";
import { limitesEfectivosSchema } from "./limites-motoristas";

export const empresaDetalleSchema = empresaSchema.extend({
  limites_motoristas: limitesEfectivosSchema.optional(),
  razon_social: z.string().nullable(),
  identificacion_fiscal: z.string().nullable(),
  telefono: z.string().nullable(),
  correo: z.string().nullable(),
  pais: z.object({ id: z.string(), iso2: z.string(), nombre: z.string() }),
});
export const catalogoSchema = z.object({
  resultados: z.array(
    z.object({ id: z.string(), codigo: z.string(), nombre: z.string() }),
  ),
});
const puntoSchema = z.object({
  sucursal_id: z.string().nullable(),
  sucursal_nombre: z.string().nullable(),
  ubicacion: z.object({
    id: z.string(),
    nombre: z.string(),
    direccion: z.string(),
  }),
});
export const opcionesSolicitudSchema = z.object({
  empresa_id: z.string(),
  sucursal_id: z.string().nullable(),
  modalidad_seleccionada: z.string().nullable(),
  mensaje_disponibilidad: z.string().nullable(),
  puede_crear_envio_especial: z.boolean(),
  modalidades: z.array(
    z.object({
      codigo: z.string(),
      nombre: z.string(),
      requiere_destino_registrado: z.boolean(),
    }),
  ),
  origenes: z.array(puntoSchema),
  destinos: z.array(puntoSchema),
});
export const ubicacionGestionSchema = ubicacionEmpresaSchema.extend({
  ubicacion: ubicacionEmpresaSchema.shape.ubicacion.extend({
    pais: z.object({ id: z.string(), nombre: z.string() }),
    tipo_ubicacion: z.object({
      id: z.string(),
      codigo: z.string(),
      nombre: z.string(),
    }),
    departamento: z.string().nullable(),
    municipio: z.string().nullable(),
    ciudad: z.string().nullable(),
    colonia: z.string().nullable(),
    telefono: z.string().nullable(),
    nombre_contacto: z.string().nullable(),
    instrucciones: z.string().nullable(),
  }),
});
export type UbicacionGestion = z.infer<typeof ubicacionGestionSchema>;
