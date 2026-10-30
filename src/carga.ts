import { z } from "zod";
import { ApiError } from "./errores";

export const cantidadSchema = z.number().int().min(0).max(2147483647);
const contador = z.number().int().nonnegative();
// La ausencia durante el despliegue y el null histórico nunca significan cero.
export const cargaFrascosSchema = z.object({
  limite_frascos: cantidadSchema.min(1).optional(),
  frascos_comprometidos: contador.optional(),
  frascos_en_transporte: contador.optional(),
  frascos_reservados: contador.optional(),
  frascos_disponibles: contador.optional(),
  solicitudes_sin_cantidad_frascos: contador.optional(),
});
export const conteosResumenSchema = z.object({
  recogidos_conocidos: contador,
  entregados_conocidos: contador,
  recolecciones_sin_cantidad: contador,
  entregas_sin_cantidad: contador,
});
export function validarCarga(tubos: unknown, frascos: unknown) {
  const campos: Record<string, string[]> = {};
  for (const [campo, valor] of Object.entries({
    cantidad_tubos: tubos,
    cantidad_frascos: frascos,
  }))
    if (!cantidadSchema.safeParse(valor).success)
      campos[campo] = ["Introduce un entero entre 0 y 2147483647."];
  if (!Object.keys(campos).length && tubos === 0 && frascos === 0) {
    campos.cantidad_tubos = ["Declara al menos un tubo o un frasco."];
    campos.cantidad_frascos = campos.cantidad_tubos;
  }
  if (Object.keys(campos).length) throw new ApiError(400, campos);
  return {
    cantidad_tubos: tubos as number,
    cantidad_frascos: frascos as number,
  };
}
export const cantidad = (valor: number | null | undefined) =>
  valor == null
    ? "No registrado"
    : new Intl.NumberFormat("es-HN").format(valor);
