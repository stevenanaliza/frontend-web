import { useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Settings2, Check, X } from "lucide-react";
import { useAuth } from "./auth";
import { api, parsear } from "./api";
import { motoristaSchema, type Motorista } from "./contratos-admin";
import {
  Cabecera,
  Campo,
  ErroresFormulario,
  Filtros,
  TablaRemota,
  usePaginaRemota,
} from "./admin-comunes";
import { ErrorCampo, Etiqueta, Panel, estados, numero } from "./componentes";
import { puedeVerReportes } from "./permisos";
import { NuevoMotorista } from "./Altas";

function EditarLimite({
  motorista,
  cerrar,
  guardado,
}: {
  motorista: Motorista;
  cerrar: () => void;
  guardado: (motorista: Motorista) => void;
}) {
  const [error, setError] = useState<unknown>(null);
  const [ocupado, setOcupado] = useState(false);
  const enviando = useRef(false);
  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviando.current) return;
    enviando.current = true;
    setOcupado(true);
    setError(null);
    const datos = new FormData(event.currentTarget);
    try {
      const actualizado = parsear(
        motoristaSchema,
        await api.solicitar(
          `/api/v1/repartidores/${encodeURIComponent(motorista.id)}/`,
          {
            method: "PATCH",
            body: JSON.stringify({
              limite_tubos: Number(datos.get("limite_tubos")),
              motivo: String(datos.get("motivo")).trim(),
            }),
          },
        ),
      );
      guardado(actualizado);
    } catch (e) {
      setError(e);
    } finally {
      enviando.current = false;
      setOcupado(false);
    }
  }
  return (
    <section
      className="panel formulario-edicion"
      aria-labelledby="editar-limite-titulo"
    >
      <div className="panel-cabecera">
        <h2 id="editar-limite-titulo">
          Límite de tubos de {motorista.usuario.nombres}{" "}
          {motorista.usuario.apellidos}
        </h2>
        <button
          className="boton icono"
          aria-label="Cerrar configuración de límite"
          disabled={ocupado}
          onClick={cerrar}
        >
          <X size={19} />
        </button>
      </div>
      <form onSubmit={guardar}>
        <ErroresFormulario error={error} />
        <p className="ayuda-form">
          Carga conocida actual: {numero(motorista.tubos_comprometidos)} tubos
          comprometidos. El servidor valida el nuevo límite y registra el
          motivo.
        </p>
        <div className="form-grid">
          <Campo
            nombre="limite_tubos"
            etiqueta="Nuevo límite de tubos"
            type="number"
            min={1}
            max={2147483647}
            step={1}
            defaultValue={motorista.limite_tubos}
            required
            error={error}
          />
          <label className="campo-form" htmlFor="motivo">
            Motivo del cambio
            <textarea
              id="motivo"
              name="motivo"
              required
              rows={3}
              aria-describedby="motivo-error"
            />
            <ErrorCampo error={error} campo="motivo" />
          </label>
        </div>
        <div className="acciones-form">
          <button
            className="boton secundario"
            type="button"
            disabled={ocupado}
            onClick={cerrar}
          >
            Cancelar
          </button>
          <button className="boton primario" disabled={ocupado}>
            {ocupado ? "Guardando…" : "Guardar límite"}
          </button>
        </div>
      </form>
    </section>
  );
}
export function Motoristas() {
  const [nuevo, setNuevo] = useState(false);
  const { perfil } = useAuth();
  const [params] = useSearchParams();
  const [seleccion, setSeleccion] = useState<Motorista | null>(null);
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
        titulo="Motoristas y límites"
        texto="Estado operativo, capacidad y límites calculados por el servidor."
        recargar={listado.recargar}
        cargando={listado.cargando}
        accion={
          perfil?.permisos.includes("repartidor.administrar") ? (
            <button className="boton primario" onClick={() => setNuevo(!nuevo)}>
              Crear motorista
            </button>
          ) : undefined
        }
      />
      {nuevo && (
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
      {seleccion && (
        <EditarLimite
          key={seleccion.id}
          motorista={seleccion}
          cerrar={() => setSeleccion(null)}
          guardado={(actualizado) => {
            setMensaje(
              `Límite actualizado a ${actualizado.limite_tubos} tubos para ${actualizado.usuario.nombres}.`,
            );
            setSeleccion(null);
            listado.recargar();
          }}
        />
      )}
      <Panel titulo="Directorio de motoristas">
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
                          {perfil?.permisos.includes(
                            "repartidor.administrar",
                          ) && (
                            <button
                              className="boton secundario"
                              onClick={() => {
                                setSeleccion(m);
                                setMensaje("");
                                requestAnimationFrame(() =>
                                  document
                                    .getElementById("limite_tubos")
                                    ?.focus(),
                                );
                              }}
                            >
                              <Settings2 size={16} aria-hidden="true" />
                              Configurar límite
                            </button>
                          )}
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
