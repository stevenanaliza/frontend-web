import { useState } from "react";
import type { z } from "zod";
import { useAuth } from "./auth";
import { api, ApiError, parsear } from "./api";
import { detalleSolicitudSchema, motoristaSchema } from "./contratos-admin";
import { cantidad, validarCarga } from "./carga";
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
  const cargaConocida =
    solicitud.cantidad_tubos !== null && solicitud.cantidad_frascos != null;
  const asignar =
    cargaConocida &&
    ["PENDING", "ASSIGNED"].includes(solicitud.estado) &&
    perfil?.permisos.includes(
      solicitud.repartidor_asignado_id
        ? "solicitud.reasignar"
        : "solicitud.asignar",
    );
  const carga =
    !terminal &&
    (antesRecoger || !cargaConocida) &&
    perfil?.permisos.includes("solicitud.asignar");
  const cancelar =
    antesRecoger && perfil?.permisos.includes("solicitud.cancelar");
  return (
    <>
      {!terminal && !cargaConocida && (
        <p className="aviso" role="status">
          Completa las cantidades no registradas antes de asignar un motorista.
          Los valores desconocidos no equivalen a cero.
        </p>
      )}
      {(asignar || carga || cancelar) && (
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
          {carga && (
            <button
              className="boton secundario"
              onClick={() => setAccion("carga")}
            >
              {!cargaConocida ? "Completar carga" : "Corregir carga"}
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
      : accion === "carga"
        ? "Actualizar carga"
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
            : "Guardar carga"
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
        } else if (accion === "carga") {
          ruta += "carga/";
          metodo = "PATCH";
          const cantidades = validarCarga(
            Number(datos.get("cantidad_tubos") ?? solicitud.cantidad_tubos),
            Number(datos.get("cantidad_frascos") ?? solicitud.cantidad_frascos),
          );
          for (const campo of ["cantidad_tubos", "cantidad_frascos"] as const)
            if (datos.has(campo)) cuerpo[campo] = cantidades[campo];
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
              cantidad_tubos: solicitud.cantidad_tubos!,
              cantidad_frascos: solicitud.cantidad_frascos!,
            }}
            nombre="repartidor_id"
            etiqueta="Motoristas disponibles"
            valor={motorista}
            cambiar={(id) => setMotorista(id)}
            describir={(m) =>
              `${m.usuario.nombres} ${m.usuario.apellidos} · ${m.tubos_disponibles} tubos y ${cantidad(m.frascos_disponibles)} frascos disponibles`
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
      {accion === "carga" && (
        <>
          <p className="ayuda-form">
            Después de recoger solo se pueden completar cantidades no
            registradas. Las cantidades conocidas se conservan. El servidor
            verifica ambos cupos.
          </p>
          <div className="form-grid">
            {(["tubos", "frascos"] as const).map((tipo) => {
              const valor = solicitud[`cantidad_${tipo}`];
              const editable =
                [
                  "PENDING",
                  "ASSIGNED",
                  "GOING_TO_PICKUP",
                  "AT_PICKUP",
                ].includes(solicitud.estado) || valor == null;
              return editable ? (
                <Campo
                  key={tipo}
                  nombre={`cantidad_${tipo}`}
                  etiqueta={`Cantidad de ${tipo}`}
                  type="number"
                  min={0}
                  max={2147483647}
                  step={1}
                  defaultValue={valor ?? ""}
                  required
                  error={operacion.error}
                />
              ) : (
                <p key={tipo}>
                  Cantidad de {tipo}: {cantidad(valor)} · Ya recogida
                </p>
              );
            })}
          </div>
        </>
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
