import { z } from "zod";
export class ApiError extends Error {
  constructor(
    public status: number,
    public campos: Record<string, unknown> = {},
    public espera = 0,
  ) {
    const mensajes: Record<number, string> = {
      0: "No se pudo conectar con el servidor. Comprueba tu conexión y la disponibilidad del servicio.",
      400: "Revisa los campos indicados.",
      401: "La sesión no está autorizada. Inicia sesión nuevamente.",
      403: "No tienes permisos para consultar esta información.",
      404: "El recurso no existe o no está disponible en tu alcance.",
      409: "La operación entra en conflicto con una regla vigente.",
      429: "Se alcanzó el límite de intentos. Espera antes de volver a intentar.",
    };
    super(
      status >= 500
        ? (mensajes[status] ??
            "El servidor no pudo completar la operación. Intenta más tarde.")
        : typeof campos.detail === "string"
          ? campos.detail
          : (mensajes[status] ??
            `No se pudo completar la operación (HTTP ${status}).`),
    );
  }
}
export class ContratoError extends Error {
  constructor(public rutas: string[]) {
    super("La respuesta del servidor no coincide con el contrato esperado.");
  }
}
export function parsear<T>(schema: z.ZodType<T>, valor: unknown): T {
  const resultado = schema.safeParse(valor);
  if (!resultado.success)
    throw new ContratoError(
      [
        ...new Set(
          resultado.error.issues.map(
            (issue) => issue.path.join(".") || "respuesta",
          ),
        ),
      ].slice(0, 8),
    );
  return resultado.data;
}
