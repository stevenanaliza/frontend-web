import { useState } from "react";
import type { z } from "zod";
import { useAuth } from "./auth";
import { api, ApiError, parsear } from "./api";
import { detalleSolicitudSchema, motoristaSchema } from "./contratos-admin";
import { Campo } from "./admin-comunes";
import { Formulario, SelectorRemoto, useOperacion } from "./formularios";

type Solicitud = z.infer<typeof detalleSolicitudSchema>;
export function OperacionesSolicitud({
  solicitud,
  actualizada,
}: {
  solicitud: Solicitud;
  actualizada: () => void;
}) {
  const { perfil } = useAuth();
  const [accion, setAccion] = useState("");
  const terminal = [
    "DELIVERED",
    "CANCELLED",
    "PICKUP_FAILED",
    "DELIVERY_FAILED",
  ].includes(solicitud.estado);
  const antesRecoger = [
    "PENDING",
    "ASSIGNED",
    "GOING_TO_PICKUP",
    "AT_PICKUP",
  ].includes(solicitud.estado);
  const asignar =
    ["PENDING", "ASSIGNED"].includes(solicitud.estado) &&
    perfil?.permisos.includes(
      solicitud.repartidor_asignado_id
        ? "solicitud.reasignar"
        : "solicitud.asignar",
    );
  const tubos =
    !terminal &&
    (antesRecoger || solicitud.cantidad_tubos === null) &&
    perfil?.permisos.includes("solicitud.asignar");
  const cancelar =
    antesRecoger && perfil?.permisos.includes("solicitud.cancelar");
  return (
    <>
      {(asignar || tubos || cancelar) && (
        <div className="acciones separacion-panel">
          {asignar && (
            <button
              className="boton primario"
              onClick={() => setAccion("asignar")}
            >
              {solicitud.repartidor_asignado_id
                ? "Reasignar motorista"
                : "Asignar motorista"}
            </button>
          )}
          {tubos && (
            <button
              className="boton secundario"
              onClick={() => setAccion("tubos")}
            >
              {solicitud.cantidad_tubos === null
                ? "Declarar cantidad de tubos"
                : "Corregir cantidad de tubos"}
            </button>
          )}
          {cancelar && (
            <button
              className="boton secundario"
              onClick={() => setAccion("cancelar")}
            >
              Cancelar solicitud
            </button>
          )}
        </div>
      )}
      {accion && (
        <Operacion
          key={`${solicitud.id}:${accion}`}
          accion={accion}
          solicitud={solicitud}
          cerrar={() => setAccion("")}
          guardado={() => {
            setAccion("");
            actualizada();
          }}
        />
      )}
    </>
  );
}
function Operacion({
  accion,
  solicitud,
  cerrar,
  guardado,
}: {
  accion: string;
  solicitud: Solicitud;
  cerrar: () => void;
  guardado: () => void;
}) {
  const [motorista, setMotorista] = useState("");
  const operacion = useOperacion();
  const titulo =
    accion === "asignar"
      ? solicitud.repartidor_asignado_id
        ? "Reasignar motorista"
        : "Asignar motorista"
      : accion === "tubos"
        ? "Actualizar cantidad de tubos"
        : "Cancelar solicitud";
  return (
    <Formulario
      titulo={titulo}
      operacion={operacion}
      cancelar={cerrar}
      textoGuardar={
        accion === "cancelar"
          ? "Confirmar cancelación"
          : accion === "asignar"
            ? "Confirmar asignación"
            : "Guardar cantidad de tubos"
      }
      enviar={async (datos) => {
        const motivo = String(datos.get("motivo")).trim();
        if (!motivo)
          throw new ApiError(400, {
            motivo: ["Escribe el motivo de la operación."],
          });
        let ruta = `/api/v1/solicitudes/${encodeURIComponent(solicitud.id)}/`;
        let cuerpo: Record<string, unknown> = { motivo };
        let metodo = "POST";
        if (accion === "asignar") {
          if (!motorista)
            throw new ApiError(400, {
              repartidor_id: ["Selecciona un motorista disponible."],
            });
          ruta += "asignaciones/";
          cuerpo.repartidor_id = motorista;
        } else if (accion === "tubos") {
          ruta += "cantidad-tubos/";
          metodo = "PATCH";
          cuerpo.cantidad_tubos = Number(datos.get("cantidad_tubos"));
        } else {
          ruta += "transiciones/";
          cuerpo.estado_destino = "CANCELLED";
        }
        parsear(
          detalleSolicitudSchema,
          await api.solicitar(ruta, {
            method: metodo,
            body: JSON.stringify(cuerpo),
          }),
        );
        guardado();
      }}
    >
      {accion === "asignar" && (
        <>
          <p className="ayuda-form">
            Se consultan los perfiles disponibles para esta empresa y el tamaño
            del pedido. La asignación revalida GPS, jornada, cupo y prioridad en
            el servidor.
          </p>
          <SelectorRemoto
            ruta="/api/v1/repartidores/disponibles/"
            schema={motoristaSchema}
            filtros={{
              empresa_id: solicitud.empresa_id,
              ...(solicitud.cantidad_tubos === null
                ? {}
                : { cantidad_tubos: solicitud.cantidad_tubos }),
            }}
            nombre="repartidor_id"
            etiqueta="Motoristas disponibles"
            valor={motorista}
            cambiar={(id) => setMotorista(id)}
            describir={(m) =>
              `${m.usuario.nombres} ${m.usuario.apellidos} · ${m.tubos_disponibles} tubos disponibles`
            }
            permitido={(m) =>
              m.puede_recibir_solicitudes &&
              m.empresa_id === solicitud.empresa_id &&
              m.id !== solicitud.repartidor_asignado_id
            }
            error={operacion.error}
          />
        </>
      )}
      {accion === "tubos" && (
        <Campo
          nombre="cantidad_tubos"
          etiqueta="Cantidad de tubos"
          type="number"
          min={1}
          max={2147483647}
          step={1}
          defaultValue={solicitud.cantidad_tubos ?? ""}
          required
          error={operacion.error}
        />
      )}
      <Campo
        nombre="motivo"
        etiqueta="Motivo"
        required
        error={operacion.error}
      />
      {accion === "cancelar" && (
        <label className="confirmacion">
          <input type="checkbox" required />
          Confirmo la cancelación de la solicitud {solicitud.numero}.
        </label>
      )}
    </Formulario>
  );
}
