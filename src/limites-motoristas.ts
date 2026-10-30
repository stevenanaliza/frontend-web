import { z } from "zod";
import type { Perfil } from "./contratos";

const limites = {
  limite_frascos: z.number().int().min(1).max(2147483647).optional(),
  limite_tubos: z.number().int().min(1).max(2147483647),
  limite_solicitudes: z.number().int().min(1).max(5),
};
export const limitesEfectivosSchema = z.object({
  alcance: z.enum(["EMPRESA", "RED"]),
  ...limites,
});
export const limitesMotoristasSchema = z.discriminatedUnion("alcance", [
  z.object({
    alcance: z.literal("EMPRESA"),
    empresa_id: z.string().min(1),
    ...limites,
  }),
  z.object({ alcance: z.literal("RED"), ...limites }),
]);
export type LimitesMotoristas = z.infer<typeof limitesMotoristasSchema>;
export function puedeConfigurarLimites(
  perfil: Perfil,
  datos: LimitesMotoristas,
) {
  if (datos.alcance === "RED")
    return (
      perfil.permisos.includes("configuracion.administrar") &&
      perfil.roles.some((r) => r.tipo_alcance === "GLOBAL")
    );
  return (
    perfil.permisos.includes("empresa.administrar") &&
    perfil.roles.some(
      (r) =>
        r.tipo_alcance === "GLOBAL" ||
        (r.tipo_alcance === "EMPRESA" && r.empresa_id === datos.empresa_id),
    )
  );
}
