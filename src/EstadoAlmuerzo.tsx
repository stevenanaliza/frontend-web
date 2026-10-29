import { Etiqueta } from "./componentes";
import {
  horaInicioAlmuerzo,
  textoAlmuerzo,
  type AlmuerzoMotorista,
} from "./almuerzos";
import "./almuerzos.css";

export function EstadoAlmuerzo({
  motorista,
  compacto = false,
}: {
  motorista: AlmuerzoMotorista;
  compacto?: boolean;
}) {
  const texto = textoAlmuerzo(motorista);
  const inicio = motorista.en_almuerzo && motorista.almuerzo_iniciado_en;
  return (
    <span className={compacto ? "almuerzo-resumen" : "almuerzo-indicador"}>
      {compacto ? (
        texto
      ) : (
        <Etiqueta tono={motorista.en_almuerzo ? "ambar" : ""}>{texto}</Etiqueta>
      )}
      {inicio && (
        <small>
          Desde <time dateTime={inicio}>{horaInicioAlmuerzo(inicio)}</time>
        </small>
      )}
      {motorista.en_almuerzo && !inicio && (
        <small>Hora de inicio no informada</small>
      )}
    </span>
  );
}
