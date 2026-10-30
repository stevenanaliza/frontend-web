import { cantidad } from "./carga";
import {
  Link,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  UserRound,
  Package,
} from "lucide-react";
import { useAuth } from "./auth";
import { api, parsear } from "./api";
import {
  detalleSolicitudSchema,
  estadosSolicitud,
  grupoSolicitanteSchema,
  grupoSucursalSchema,
  solicitudSchema,
  type GrupoSolicitud,
} from "./contratos-admin";
import {
  Cabecera,
  Filtros,
  TablaRemota,
  usePaginaRemota,
} from "./admin-comunes";
import {
  Cargando,
  ErrorVista,
  Etiqueta,
  Panel,
  fechaHora,
  numero,
  useConsulta,
} from "./componentes";
import { EvidenciasSolicitud } from "./evidencias";
import { OperacionesSolicitud } from "./OperacionesSolicitud";
import { Exito } from "./formularios";
import { useState } from "react";

export function Solicitudes() {
  const { perfil } = useAuth();
  const [params, setParams] = useSearchParams();
  const por = params.get("por") === "solicitante" ? "solicitante" : "sucursal";
  const empresa = params.get("empresa_id") ?? "";
  const seleccion = params.get("grupo");
  const nombre = params.get("nombre_grupo");
  const grupos = usePaginaRemota<GrupoSolicitud>(
    "/api/v1/solicitudes/agrupaciones/",
    por === "sucursal" ? grupoSucursalSchema : grupoSolicitanteSchema,
    { por, empresa_id: empresa },
    "grupos",
  );
  function seleccionar(
    id: string | null,
    empresaId: string,
    nombreGrupo: string,
  ) {
    const siguiente = new URLSearchParams(params);
    siguiente.set("empresa_id", empresaId);
    siguiente.set("grupo", id ?? "sin-sucursal");
    siguiente.set("nombre_grupo", nombreGrupo);
    siguiente.delete("pagina");
    siguiente.delete("pagina_grupos");
    setParams(siguiente);
  }
  function agrupar(valor: string) {
    const siguiente = new URLSearchParams(params);
    siguiente.set("por", valor);
    [
      "grupo",
      "nombre_grupo",
      "pagina",
      "pagina_grupos",
      "estado",
      "prioridad",
    ].forEach((k) => siguiente.delete(k));
    setParams(siguiente);
  }
  return (
    <>
      <Cabecera
        titulo="Solicitudes"
        texto="Revisa los traslados por sucursal o por la persona que los creó."
        recargar={grupos.recargar}
        cargando={grupos.cargando}
        accion={
          perfil?.permisos.includes("solicitud.crear") ? (
            <Link className="boton primario" to="/solicitudes/nueva">
              Crear solicitud
            </Link>
          ) : undefined
        }
      />
      <div className="grupo-modo" role="group" aria-label="Agrupar solicitudes">
        <button
          className={`boton ${por === "sucursal" ? "primario" : "secundario"}`}
          aria-pressed={por === "sucursal"}
          onClick={() => agrupar("sucursal")}
        >
          <Building2 size={17} aria-hidden="true" />
          Por sucursal
        </button>
        <button
          className={`boton ${por === "solicitante" ? "primario" : "secundario"}`}
          aria-pressed={por === "solicitante"}
          onClick={() => agrupar("solicitante")}
        >
          <UserRound size={17} aria-hidden="true" />
          Por solicitante
        </button>
      </div>
      <Filtros empresa error={grupos.error} conservar={["por"]} />
      <Panel
        titulo={
          por === "sucursal"
            ? "Sucursales con solicitudes"
            : "Personas solicitantes"
        }
      >
        <TablaRemota
          consulta={grupos}
          tituloVacio="No hay grupos de solicitudes en tu alcance"
        >
          {(items) => (
            <div
              className="tabla-scroll"
              role="region"
              aria-label="Grupos de solicitudes"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th>{por === "sucursal" ? "Sucursal" : "Solicitante"}</th>
                    <th>Empresa</th>
                    <th>Solicitudes</th>
                    <th>Consulta</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((grupo) => {
                    const deSucursal = "sucursal_id" in grupo;
                    const id = deSucursal
                      ? grupo.sucursal_id
                      : grupo.solicitada_por_id;
                    const titulo = deSucursal
                      ? (grupo.sucursal_nombre ?? "Sin sucursal")
                      : `${grupo.solicitante_nombres} ${grupo.solicitante_apellidos}`;
                    return (
                      <tr
                        key={`${grupo.empresa_id}:${id ?? "sin-sucursal"}`}
                        className={
                          seleccion === (id ?? "sin-sucursal")
                            ? "fila-seleccionada"
                            : ""
                        }
                      >
                        <td>
                          <strong>{titulo}</strong>
                        </td>
                        <td>{grupo.empresa_nombre}</td>
                        <td>{numero(grupo.total)}</td>
                        <td>
                          <button
                            className="boton secundario"
                            onClick={() =>
                              seleccionar(id, grupo.empresa_id, titulo)
                            }
                          >
                            Ver solicitudes
                            <ArrowRight size={16} aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TablaRemota>
      </Panel>
      {seleccion && empresa ? (
        <SolicitudesGrupo
          key={`${por}:${empresa}:${seleccion}`}
          empresa={empresa}
          por={por}
          grupo={seleccion}
          titulo={nombre ?? "Grupo seleccionado"}
        />
      ) : (
        <div className="nota-informativa">
          <Package size={19} aria-hidden="true" />
          <p>
            Selecciona un grupo para consultar sus solicitudes. Cada lista
            conserva su paginación del servidor.
          </p>
        </div>
      )}
    </>
  );
}
function SolicitudesGrupo({
  empresa,
  por,
  grupo,
  titulo,
}: {
  empresa: string;
  por: string;
  grupo: string;
  titulo: string;
}) {
  const [params, setParams] = useSearchParams();
  const filtros: Record<string, string> = {
    empresa_id: empresa,
    estado: params.get("estado") ?? "",
    prioridad: params.get("prioridad") ?? "",
  };
  if (por === "solicitante") filtros.solicitada_por_id = grupo;
  else if (grupo === "sin-sucursal") filtros.sin_sucursal = "true";
  else filtros.sucursal_id = grupo;
  const solicitudes = usePaginaRemota(
    "/api/v1/solicitudes/",
    solicitudSchema,
    filtros,
  );
  return (
    <section className="seccion-grupo">
      <Cabecera
        titulo={titulo}
        nivel={2}
        texto="El solicitante identifica a la persona que creó cada solicitud."
        recargar={solicitudes.recargar}
        cargando={solicitudes.cargando}
        accion={
          <button
            className="boton texto"
            onClick={() => {
              const nuevo = new URLSearchParams(params);
              [
                "grupo",
                "nombre_grupo",
                "pagina",
                "estado",
                "prioridad",
              ].forEach((k) => nuevo.delete(k));
              setParams(nuevo);
            }}
          >
            Cerrar grupo
          </button>
        }
      />
      <Filtros
        error={solicitudes.error}
        conservar={[
          "por",
          "empresa_id",
          "grupo",
          "nombre_grupo",
          "pagina_grupos",
        ]}
      >
        <label htmlFor="estado">
          Estado
          <select
            id="estado"
            name="estado"
            defaultValue={params.get("estado") ?? ""}
          >
            <option value="">Todos los estados</option>
            {Object.entries(estadosSolicitud).map(([valor, texto]) => (
              <option key={valor} value={valor}>
                {texto}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="prioridad">
          Prioridad
          <select
            id="prioridad"
            name="prioridad"
            defaultValue={params.get("prioridad") ?? ""}
          >
            <option value="">Todas</option>
            <option value="NORMAL">Normal</option>
            <option value="PRIORITY">Prioritaria</option>
          </select>
        </label>
      </Filtros>
      <Panel titulo="Solicitudes del grupo">
        <TablaRemota
          consulta={solicitudes}
          tituloVacio="Sin solicitudes para estos filtros"
        >
          {(items) => (
            <div
              className="tabla-scroll"
              role="region"
              aria-label="Tabla de solicitudes"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th>Solicitud</th>
                    <th>Creada por</th>
                    <th>Recorrido</th>
                    <th>Tubos</th>
                    <th>Frascos</th>
                    <th>Estado</th>
                    <th>Consulta</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.numero}</strong>
                        <small>{s.sucursal?.nombre ?? "Sin sucursal"}</small>
                      </td>
                      <td>
                        {s.solicitante.nombres} {s.solicitante.apellidos}
                      </td>
                      <td className="celda-texto">
                        <span>{s.origen.nombre}</span>
                        <small>
                          Destino:{" "}
                          {s.destino?.nombre ??
                            s.destino_especial ??
                            "Sin declarar"}
                        </small>
                      </td>
                      <td>{cantidad(s.cantidad_tubos)}</td>
                      <td>{cantidad(s.cantidad_frascos)}</td>
                      <td>
                        <Etiqueta
                          tono={
                            s.estado === "DELIVERED"
                              ? "verde"
                              : s.prioridad === "PRIORITY"
                                ? "ambar"
                                : ""
                          }
                        >
                          {estadosSolicitud[s.estado] ?? s.estado}
                        </Etiqueta>
                      </td>
                      <td>
                        <Link
                          className="boton secundario"
                          to={`/solicitudes/${s.id}`}
                          state={{ volver: params.toString() }}
                        >
                          Ver detalle
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TablaRemota>
      </Panel>
    </section>
  );
}
export function DetalleSolicitud() {
  const ubicacion = useLocation();
  const [mensaje, setMensaje] = useState(
    typeof ubicacion.state?.mensaje === "string" ? ubicacion.state.mensaje : "",
  );
  const volver =
    typeof ubicacion.state?.volver === "string"
      ? `?${ubicacion.state.volver}`
      : "";
  const { id = "" } = useParams();
  const { perfil } = useAuth();
  const ruta = `/api/v1/solicitudes/${encodeURIComponent(id)}/`;
  const { datos, error, cargando, recargar } = useConsulta(
    async (signal) =>
      parsear(detalleSolicitudSchema, await api.solicitar(ruta, { signal })),
    ruta,
  );
  // El detalle no publica una zona operativa; UTC evita atribuirle la zona del navegador o de otra empresa.
  const zona = "UTC";
  return (
    <>
      <Link className="enlace-volver" to={`/solicitudes${volver}`}>
        <ArrowLeft size={17} aria-hidden="true" />
        Volver a solicitudes
      </Link>
      <Cabecera
        titulo={datos?.numero ?? "Detalle de solicitud"}
        texto="Trazabilidad del traslado y sus evidencias."
        recargar={recargar}
        cargando={cargando}
      />
      {cargando ? (
        <Cargando />
      ) : error ? (
        <ErrorVista error={error} reintentar={recargar} />
      ) : (
        datos && (
          <>
            {mensaje && <Exito>{mensaje}</Exito>}
            <OperacionesSolicitud
              solicitud={datos}
              actualizada={() => {
                setMensaje("Solicitud actualizada por el servidor.");
                recargar();
              }}
            />
            <Panel
              titulo="Información de la solicitud"
              extra={
                <Etiqueta>
                  {estadosSolicitud[datos.estado] ?? datos.estado}
                </Etiqueta>
              }
            >
              <dl className="datos-detalle">
                <div>
                  <dt>Creada por</dt>
                  <dd>
                    {datos.solicitante.nombres} {datos.solicitante.apellidos}
                  </dd>
                </div>
                <div>
                  <dt>Sucursal</dt>
                  <dd>{datos.sucursal?.nombre ?? "Sin sucursal"}</dd>
                </div>
                <div>
                  <dt>Cantidad de tubos</dt>
                  <dd>{cantidad(datos.cantidad_tubos)}</dd>
                </div>
                <div>
                  <dt>Cantidad de frascos</dt>
                  <dd>{cantidad(datos.cantidad_frascos)}</dd>
                </div>
                <div>
                  <dt>Tipo de servicio</dt>
                  <dd>{datos.tipo_servicio.nombre}</dd>
                </div>
                <div>
                  <dt>Origen</dt>
                  <dd>
                    {datos.origen.nombre}
                    <small>{datos.origen.direccion}</small>
                  </dd>
                </div>
                <div>
                  <dt>Destino</dt>
                  <dd>
                    {datos.destino?.nombre ??
                      datos.destino_especial ??
                      "Sin declarar"}
                    <small>{datos.destino?.direccion}</small>
                  </dd>
                </div>
                <div>
                  <dt>Fecha de creación (UTC)</dt>
                  <dd>{fechaHora(datos.creado_en, zona)}</dd>
                </div>
                <div>
                  <dt>Notas</dt>
                  <dd>{datos.notas ?? "Sin notas"}</dd>
                </div>
              </dl>
            </Panel>
            <Panel titulo="Artículos históricos" className="separacion-panel">
              <div
                className="tabla-scroll"
                role="region"
                aria-label="Tabla de artículos históricos"
                tabIndex={0}
              >
                <table>
                  <thead>
                    <tr>
                      <th>Artículo</th>
                      <th>Cantidad descriptiva</th>
                      <th>Condición de transporte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.articulos_historicos.map((a) => (
                      <tr key={a.id}>
                        <td>
                          {a.tipo_articulo}
                          <small>{a.descripcion}</small>
                          <small>{a.codigo_referencia}</small>
                          <small>{a.notas}</small>
                        </td>
                        <td>{a.cantidad}</td>
                        <td>{a.condicion_transporte ?? "Sin declarar"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {datos.articulos_historicos.length === 0 && (
                  <p className="panel-nota">Sin artículos históricos.</p>
                )}
              </div>
              <p className="panel-nota">
                Contenido histórico de solo lectura. No determina los conteos
                actuales de tubos o frascos.
              </p>
            </Panel>
            {perfil?.permisos.includes("evidencia.ver") && (
              <EvidenciasSolicitud solicitudId={id} />
            )}
            <Panel
              titulo="Historial de la solicitud"
              className="separacion-panel"
            >
              <ol className="historial">
                {datos.eventos.map((evento) => (
                  <li key={evento.id}>
                    <strong>
                      {evento.tipo.replaceAll("_", " ").toLocaleLowerCase("es")}
                    </strong>
                    <time dateTime={evento.creado_en}>
                      {fechaHora(evento.creado_en, zona)}
                    </time>
                  </li>
                ))}
              </ol>
              {datos.eventos.length === 0 && (
                <p className="panel-nota">Sin eventos registrados.</p>
              )}
            </Panel>
          </>
        )
      )}
    </>
  );
}
