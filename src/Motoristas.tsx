import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check } from "lucide-react";
import { useAuth } from "./auth";
import { motoristaSchema } from "./contratos-admin";
import {
  Cabecera,
  Filtros,
  TablaRemota,
  usePaginaRemota,
} from "./admin-comunes";
import { Etiqueta, Panel, estados, numero } from "./componentes";
import { puedeVerReportes } from "./permisos";
import { NuevoMotorista } from "./Altas";

export function Motoristas() {
  const { perfil } = useAuth();
  const [params] = useSearchParams();
  const empresa = params.get("empresa_id") ?? perfil?.empresa?.id ?? "";
  const [nuevo, setNuevo] = useState(params.get("crear") === "1");
  const [mensaje, setMensaje] = useState("");
  const listado = usePaginaRemota("/api/v1/repartidores/", motoristaSchema, {
    empresa_id: params.get("empresa_id") ?? "",
    activo: params.get("activo") ?? "",
    estado_operativo: params.get("estado_operativo") ?? "",
    capacidad: params.get("capacidad") ?? "",
  });
  return (
    <>
      <Cabecera
        titulo="Motoristas"
        texto="Estado operativo, capacidad y límites calculados por el servidor."
        recargar={listado.recargar}
        cargando={listado.cargando}
        accion={
          <>
            {perfil?.permisos.includes("empresa.ver") && (
              <Link
                className="boton secundario"
                to={`/limites-motoristas${empresa ? `?empresa_id=${encodeURIComponent(empresa)}` : ""}`}
              >
                Límites compartidos
              </Link>
            )}
            {perfil?.permisos.includes("repartidor.administrar") ? (
              <button
                className="boton primario"
                onClick={() => setNuevo(!nuevo)}
              >
                Crear motorista
              </button>
            ) : undefined}
          </>
        }
      />
      {nuevo && perfil?.permisos.includes("repartidor.administrar") && (
        <NuevoMotorista
          cerrar={() => setNuevo(false)}
          creado={() => {
            setNuevo(false);
            setMensaje("Perfil de motorista creado.");
            listado.recargar();
          }}
        />
      )}
      <Filtros empresa error={listado.error}>
        <label htmlFor="activo">
          Perfil
          <select
            id="activo"
            name="activo"
            defaultValue={params.get("activo") ?? ""}
          >
            <option value="">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
        </label>
        <label htmlFor="estado_operativo">
          Estado operativo
          <select
            id="estado_operativo"
            name="estado_operativo"
            defaultValue={params.get("estado_operativo") ?? ""}
          >
            <option value="">Todos</option>
            {[
              "OFFLINE",
              "AVAILABLE",
              "ON_ROUTE",
              "PAUSED",
              "OUT_OF_SERVICE",
            ].map((e) => (
              <option value={e} key={e}>
                {estados[e]}
              </option>
            ))}
          </select>
        </label>
      </Filtros>
      {mensaje && (
        <div className="exito" role="status">
          <Check size={18} aria-hidden="true" />
          {mensaje}
        </div>
      )}
      <Panel titulo="Directorio de motoristas">
        <p className="panel-nota">
          Cada motorista tiene su propio cupo, calculado con los límites
          compartidos vigentes de su empresa o red.
        </p>
        <TablaRemota
          consulta={listado}
          tituloVacio="No hay motoristas para estos filtros"
        >
          {(items) => (
            <div
              className="tabla-scroll"
              role="region"
              aria-label="Directorio de motoristas"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th>Motorista</th>
                    <th>Vehículo</th>
                    <th>Estado</th>
                    <th>Carga actual</th>
                    <th>Cupo disponible</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <strong>
                          {m.usuario.nombres} {m.usuario.apellidos}
                        </strong>
                        <small>{m.usuario.correo}</small>
                        <small>
                          {m.activo ? "Perfil activo" : "Perfil inactivo"}
                        </small>
                      </td>
                      <td>{m.vehiculo?.placa ?? "Sin vehículo"}</td>
                      <td>
                        <Etiqueta>
                          {estados[m.estado_operativo] ?? m.estado_operativo}
                        </Etiqueta>
                        <small>{estados[m.capacidad] ?? m.capacidad}</small>
                      </td>
                      <td>
                        <strong>
                          {numero(m.tubos_comprometidos)} /{" "}
                          {numero(m.limite_tubos)} tubos
                        </strong>
                        <small>
                          {m.solicitudes_activas} / {m.limite_solicitudes}{" "}
                          solicitudes activas
                        </small>
                        {m.solicitudes_sin_cantidad_tubos > 0 && (
                          <small className="advertencia-texto">
                            Carga parcial: {m.solicitudes_sin_cantidad_tubos}{" "}
                            sin cantidad
                          </small>
                        )}
                      </td>
                      <td>
                        {numero(m.tubos_disponibles)} tubos
                        <small>
                          {m.puede_recibir_solicitudes
                            ? "Puede recibir solicitudes"
                            : "No puede recibir solicitudes"}
                        </small>
                      </td>
                      <td>
                        <div className="acciones-celda">
                          {perfil && puedeVerReportes(perfil) && (
                            <Link
                              className="boton texto"
                              to={`/motoristas/${m.id}`}
                            >
                              Ver resumen
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TablaRemota>
      </Panel>
    </>
  );
}
