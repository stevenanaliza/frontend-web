import type { Motorista } from "./contratos-admin";

export type FiltroAlmuerzo = "" | "true" | "false" | "sin_dato";
export type AlmuerzoMotorista = Pick<
  Motorista,
  "en_almuerzo" | "almuerzo_iniciado_en"
>;

export function coincideAlmuerzo(
  motorista: AlmuerzoMotorista,
  filtro: FiltroAlmuerzo,
) {
  if (!filtro) return true;
  if (filtro === "sin_dato") return motorista.en_almuerzo === undefined;
  return motorista.en_almuerzo === (filtro === "true");
}

export function textoAlmuerzo(motorista: AlmuerzoMotorista) {
  return motorista.en_almuerzo === undefined
    ? "Sin información de almuerzo"
    : motorista.en_almuerzo
      ? "En almuerzo"
      : "Fuera de almuerzo";
}

// Conservar la hora y el desplazamiento enviados por el servidor, sin deducir
// la zona de una empresa a partir de la configuración horaria del navegador.
export function horaInicioAlmuerzo(valor: string) {
  const fecha =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):\d{2}(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(
      valor,
    );
  if (!fecha) return valor;
  const [, ano, mes, dia, horas, minutos, offset] = fecha;
  return `${dia}/${mes}/${ano}, ${horas}:${minutos} (UTC${offset === "Z" ? "" : offset})`;
}
