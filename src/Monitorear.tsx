import { cantidad } from "./carga";
import { CargaFrascos } from "./CargaFrascos";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bike,
  Clock,
  LocateFixed,
  MapPin,
  Pause,
  Play,
  Search,
  X,
} from "lucide-react";
import { api, ApiError } from "./api";
import { estadosSolicitud } from "./contratos-admin";
import { Cabecera } from "./admin-comunes";
import {
  Cargando,
  ErrorVista,
  Etiqueta,
  Panel,
  Vacio,
  estados,
  numero,
  useConsulta,
} from "./componentes";
import { useMonitoreo } from "./useMonitoreo";
import {
  antiguedadGps,
  cargarFichaMonitoreo,
  estadoGps,
  type MotoristaMonitor,
} from "./monitoreo";
import { useAuth } from "./auth";
import { puedeElegirEmpresa, puedeMonitorear } from "./permisos";
import "./monitoreo.css";
import { EstadoAlmuerzo } from "./EstadoAlmuerzo";
import {
  coincideAlmuerzo,
  horaInicioAlmuerzo as fechaHoraServidor,
  type FiltroAlmuerzo,
} from "./almuerzos";
const MapaMotoristas = lazy(() => import("./MapaMotoristas"));
const hora = (valor: string | number) =>
  new Intl.DateTimeFormat("es-HN", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Tegucigalpa",
  }).format(new Date(valor));

function DatosFicha({
  registro,
  actualizado,
}: {
  registro: MotoristaMonitor;
  actualizado: number;
}) {
  const { perfil } = useAuth();
  const empresa = puedeElegirEmpresa(perfil) ? undefined : perfil?.empresa?.id;
  const detalle = useConsulta(
    (signal) =>
      cargarFichaMonitoreo(
        api.solicitar,
        signal,
        registro,
        perfil?.permisos ?? [],
        empresa,
      ),
    `ficha-jornada:${registro.repartidor_id}:${registro.jornada_id}:${actualizado}`,
  );
  if (detalle.cargando)
    return <Cargando texto="Consultando carga y solicitudes…" />;
  if (detalle.error)
    return <ErrorVista error={detalle.error} reintentar={detalle.recargar} />;
  const m = detalle.datos?.motorista;
  const solicitudes = detalle.datos?.solicitudes;
  return (
    <>
      {m && (
        <>
          <h3>Carga, contacto y vehículo</h3>
          <EstadoAlmuerzo
            motorista={{
              en_almuerzo: registro.en_almuerzo,
              almuerzo_iniciado_en: m.almuerzo_iniciado_en,
            }}
          />
          <dl className="monitor-datos">
            <CargaFrascos carga={m} />
            <div>
              <dt>Solicitudes activas</dt>
              <dd>
                {numero(m.solicitudes_activas)} / {numero(m.limite_solicitudes)}
              </dd>
            </div>
            <div>
              <dt>Tubos en transporte</dt>
              <dd>{numero(m.tubos_en_transporte)}</dd>
            </div>
            <div>
              <dt>Tubos reservados</dt>
              <dd>{numero(m.tubos_reservados)}</dd>
            </div>
            <div>
              <dt>Tubos comprometidos</dt>
              <dd>
                {numero(m.tubos_comprometidos)} / {numero(m.limite_tubos)}
              </dd>
            </div>
            <div>
              <dt>Espacio para tubos</dt>
              <dd>{numero(m.tubos_disponibles)}</dd>
            </div>
            <div>
              <dt>Puede recibir solicitudes</dt>
              <dd>{m.puede_recibir_solicitudes ? "Sí" : "No"}</dd>
            </div>
            <div>
              <dt>Solicitudes sin tubos declarados</dt>
              <dd>{numero(m.solicitudes_sin_cantidad_tubos)}</dd>
            </div>
            <div>
              <dt>Teléfono</dt>
              <dd>{m.usuario.telefono || "Sin teléfono"}</dd>
            </div>
            <div className="monitor-contacto">
              <dt>Correo</dt>
              <dd>{m.usuario.correo}</dd>
            </div>
            <div className="monitor-contacto">
              <dt>Vehículo</dt>
              <dd>
                {m.vehiculo
                  ? `${m.vehiculo.placa} · ${m.vehiculo.tipo} · ${m.vehiculo.estado}`
                  : "Sin vehículo"}
              </dd>
            </div>
          </dl>
        </>
      )}
      {solicitudes && (
        <>
          <h3>Solicitudes y carga</h3>
          <p className="ayuda-form">
            Carga calculada por el servidor. Solo se muestran solicitudes dentro
            de tu alcance.
          </p>
          {!solicitudes.length ? (
            <p>No hay solicitudes activas visibles.</p>
          ) : (
            <ul className="monitor-solicitudes">
              {solicitudes.map((s) => (
                <li key={s.id}>
                  <Link to={`/solicitudes/${s.id}`}>{s.numero}</Link>
                  <span className="monitor-estado-solicitud">
                    {estadosSolicitud[s.estado] ?? s.estado}
                  </span>
                  <p>
                    {s.tipo_servicio.nombre} · {cantidad(s.cantidad_tubos)}{" "}
                    tubos · {cantidad(s.cantidad_frascos)} frascos
                  </p>
                  <p>
                    Origen: {s.origen.nombre}
                    <br />
                    Destino:{" "}
                    {s.destino?.nombre ??
                      s.destino_especial ??
                      "Sin destino declarado"}
                  </p>
                  {s.articulos_historicos.length > 0 && (
                    <Link to={`/solicitudes/${s.id}`}>
                      Ver artículos históricos en el detalle
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {!m && !solicitudes && (
        <p className="ayuda-form">
          Tu cuenta permite consultar la ubicación y la jornada. La carga y los
          pedidos requieren permisos adicionales de consulta.
        </p>
      )}
    </>
  );
}
function FichaMotorista({
  registro: r,
  actualizado,
  ahora,
  cerrar,
}: {
  registro: MotoristaMonitor;
  actualizado: number;
  ahora: number;
  cerrar: () => void;
}) {
  const edad = antiguedadGps(r, ahora);
  return (
    <Panel
      titulo="Información del motorista"
      className="monitor-ficha"
      extra={
        <button
          className="boton icono"
          aria-label="Cerrar información del motorista"
          onClick={cerrar}
        >
          <X size={19} />
        </button>
      }
    >
      <div className="monitor-ficha-contenido">
        <h3>{r.nombre}</h3>
        <div className="acciones">
          <Etiqueta>
            {estados[r.estado_operativo] ?? r.estado_operativo}
          </Etiqueta>
          <Etiqueta tono={r.en_almuerzo ? "ambar" : ""}>
            {r.en_almuerzo ? "En almuerzo" : "Fuera de almuerzo"}
          </Etiqueta>
        </div>
        <p className="ayuda-form">
          {estadoGps(r, ahora)}
          {r.punto
            ? ` · Última captura: ${hora(r.punto.registrada_en)} (hora de Honduras).`
            : " en esta jornada."}
        </p>
        <dl className="monitor-datos">
          <div>
            <dt>Servicios activos</dt>
            <dd>{numero(r.solicitudes_activas)}</dd>
          </div>
          <div>
            <dt>Antigüedad de la captura</dt>
            <dd>{edad === null ? "Sin captura" : `${numero(edad)} s`}</dd>
          </div>
          <div>
            <dt>Precisión reportada</dt>
            <dd>
              {r.punto?.precision_metros == null
                ? "Sin dato"
                : `${numero(r.punto.precision_metros, 1)} metros`}
            </dd>
          </div>
          <div>
            <dt>Fecha operativa</dt>
            <dd>{r.fecha_operativa}</dd>
          </div>
          <div className="monitor-contacto">
            <dt>Inicio de jornada</dt>
            <dd>{fechaHoraServidor(r.iniciada_en)}</dd>
          </div>
          <div className="monitor-contacto">
            <dt>Cierre programado</dt>
            <dd>{fechaHoraServidor(r.cierre_programado_en)}</dd>
          </div>
        </dl>
        <DatosFicha registro={r} actualizado={actualizado} />
      </div>
    </Panel>
  );
}
export default function Monitorear() {
  const { perfil } = useAuth();
  return perfil && puedeMonitorear(perfil) ? (
    <ContenidoMonitoreo />
  ) : (
    <Panel titulo="Permisos insuficientes">
      <Vacio
        titulo="No tienes acceso a este módulo"
        texto="El seguimiento requiere permiso de ubicación y alcance de empresa completa o global."
      />
    </Panel>
  );
}
function ContenidoMonitoreo() {
  const consulta = useMonitoreo();
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [buscar, setBuscar] = useState("");
  const [almuerzo, setAlmuerzo] = useState<FiltroAlmuerzo>("");
  const [encuadre, setEncuadre] = useState(0);
  const [ahora, setAhora] = useState(performance.now());
  const ficha = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const timer = setInterval(() => setAhora(performance.now()), 1_000);
    return () => clearInterval(timer);
  }, []);
  const registros = consulta.datos?.registros ?? [];
  const [servicios, setServicios] = useState("");
  const visibles = registros.filter(
    (r) =>
      coincideAlmuerzo(r, almuerzo) &&
      (!servicios || r.tiene_servicios_activos === (servicios === "true")) &&
      r.nombre
        .toLocaleLowerCase("es")
        .includes(buscar.trim().toLocaleLowerCase("es")),
  );
  const ubicados = visibles.filter((r) => r.punto);
  const actual = visibles.find((r) => r.repartidor_id === seleccionado);
  function seleccionar(id: string) {
    setSeleccionado(id);
    requestAnimationFrame(() => {
      ficha.current?.focus({ preventScroll: true });
      if (window.matchMedia("(max-width: 1000px)").matches)
        ficha.current?.scrollIntoView({ block: "start" });
    });
  }
  return (
    <>
      <Cabecera
        titulo="Monitorear"
        texto="Ubicación reportada y carga actual de tus motoristas."
        recargar={consulta.recargar}
        cargando={consulta.cargando}
        accion={
          <button
            className="boton secundario"
            aria-pressed={consulta.automatico}
            onClick={() => consulta.setAutomatico(!consulta.automatico)}
          >
            {consulta.automatico ? (
              <Pause size={17} aria-hidden="true" />
            ) : (
              <Play size={17} aria-hidden="true" />
            )}
            {consulta.automatico
              ? "Pausar actualización"
              : "Activar actualización"}
          </button>
        }
      />
      <div className="monitor-actualizacion" role="status">
        <Clock size={17} aria-hidden="true" />
        <span>
          {!consulta.visible
            ? "Actualización pausada: pestaña oculta"
            : consulta.error
              ? "Actualización pausada por un error; pulsa Actualizar para reintentar"
              : consulta.cargando
                ? "Consultando motoristas y ubicaciones…"
                : consulta.automatico
                  ? `Actualización automática cada ${consulta.datos?.intervalo ?? "…"} segundos`
                  : "Actualización automática pausada"}
          {consulta.actualizado &&
            ` · Última consulta: ${hora(consulta.actualizado)}`}
        </span>
      </div>
      <p className="ayuda-form monitor-explicacion">
        Los puntos muestran la última captura de la jornada vigente, también sin
        servicios o durante almuerzo. Una ubicación antigua no confirma dónde
        está ahora el motorista.
      </p>
      {consulta.error != null && (
        <>
          {consulta.error instanceof ApiError &&
            consulta.error.status === 404 && (
              <p className="aviso">
                El seguimiento de jornada todavía no está disponible en este
                servidor.
              </p>
            )}
          <ErrorVista error={consulta.error} reintentar={consulta.recargar} />
        </>
      )}
      {!consulta.datos && consulta.cargando ? (
        <Cargando />
      ) : (
        consulta.datos && (
          <>
            <form
              className="monitor-busqueda"
              onSubmit={(e) => e.preventDefault()}
            >
              <label htmlFor="buscar-motorista-monitor">
                <Search size={18} aria-hidden="true" />
                Buscar motorista
              </label>
              <input
                id="buscar-motorista-monitor"
                type="search"
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
                placeholder="Nombre del motorista"
              />
              <label
                className="monitor-filtro-almuerzo"
                htmlFor="almuerzo-monitor"
              >
                Almuerzo
                <select
                  id="almuerzo-monitor"
                  value={almuerzo}
                  onChange={(e) =>
                    setAlmuerzo(e.target.value as FiltroAlmuerzo)
                  }
                >
                  <option value="">Todos</option>
                  <option value="true">En almuerzo</option>
                  <option value="false">Fuera de almuerzo</option>
                </select>
              </label>
              <label
                className="monitor-filtro-almuerzo"
                htmlFor="servicios-monitor"
              >
                Servicios
                <select
                  id="servicios-monitor"
                  value={servicios}
                  onChange={(e) => setServicios(e.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="true">Con servicios</option>
                  <option value="false">Sin servicios</option>
                </select>
              </label>
              <p>
                {numero(visibles.length)} motoristas · {numero(ubicados.length)}{" "}
                con ubicación · {numero(visibles.length - ubicados.length)} sin
                punto disponible
              </p>
            </form>
            <div className="monitor-layout">
              <div className="monitor-columna">
                <Panel
                  titulo="Ubicación de motoristas"
                  extra={
                    <button
                      className="boton secundario"
                      disabled={!ubicados.length}
                      onClick={() => setEncuadre((e) => e + 1)}
                    >
                      <LocateFixed size={17} aria-hidden="true" />
                      Centrar motoristas
                    </button>
                  }
                >
                  <div
                    className="monitor-mapa"
                    aria-label="Mapa de ubicaciones de motoristas"
                  >
                    {import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ? (
                      <Suspense
                        fallback={<Cargando texto="Preparando mapa…" />}
                      >
                        <MapaMotoristas
                          registros={ubicados}
                          seleccionado={seleccionado}
                          seleccionar={seleccionar}
                          encuadre={encuadre}
                          ahora={ahora}
                        />
                      </Suspense>
                    ) : (
                      <div className="monitor-mapa-estado">
                        <MapPin size={36} aria-hidden="true" />
                        <h3>Mapa pendiente de configuración</h3>
                        <p>
                          Puedes consultar los motoristas y su carga en el
                          listado.
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="monitor-leyenda">
                    <span>
                      <i className="monitor-indicador" />
                      Ubicación reciente (máximo{" "}
                      {consulta.datos.criterios.antiguedad_maxima_segundos} s /{" "}
                      {consulta.datos.criterios.precision_maxima_metros} m)
                    </span>
                    <span>
                      <i className="monitor-indicador antiguo" />
                      Ubicación antigua o precisión por verificar
                    </span>
                    <p>
                      Selecciona un punto para ver la información del motorista.
                    </p>
                  </div>
                  <p className="monitor-terminos">
                    Esta sección incluye Google Maps. Su uso está sujeto a los{" "}
                    <a
                      href="https://maps.google.com/help/terms_maps/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      términos de Google Maps
                    </a>{" "}
                    y la{" "}
                    <a
                      href="https://policies.google.com/privacy"
                      target="_blank"
                      rel="noreferrer"
                    >
                      política de privacidad de Google
                    </a>
                    .
                  </p>
                </Panel>
                <div
                  ref={lista}
                  tabIndex={-1}
                  className="monitor-lista-contenedor"
                >
                  <Panel titulo="Motoristas">
                    {!visibles.length ? (
                      <Vacio
                        titulo={
                          registros.length
                            ? "Sin coincidencias"
                            : "Sin motoristas visibles"
                        }
                        texto="Solo se muestran motoristas dentro de tu alcance autorizado."
                      />
                    ) : (
                      <ul className="monitor-lista">
                        {visibles.map((r) => (
                          <li key={r.repartidor_id}>
                            <button
                              aria-pressed={seleccionado === r.repartidor_id}
                              onClick={() => seleccionar(r.repartidor_id)}
                            >
                              <Bike size={22} aria-hidden="true" />
                              <span>
                                <strong>{r.nombre}</strong>
                                <small>
                                  {estados[r.estado_operativo] ??
                                    r.estado_operativo}{" "}
                                  · {numero(r.solicitudes_activas)} servicios
                                </small>
                                <small>
                                  {estadoGps(r, ahora)}
                                  {r.punto
                                    ? ` · ${hora(r.punto.registrada_en)}`
                                    : ""}
                                </small>
                                <small>
                                  {r.en_almuerzo
                                    ? "En almuerzo"
                                    : "Fuera de almuerzo"}
                                </small>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Panel>
                </div>
              </div>
              <div
                ref={ficha}
                tabIndex={-1}
                aria-label="Detalle del motorista seleccionado"
                role="region"
                className="monitor-detalle"
              >
                {actual ? (
                  <FichaMotorista
                    key={`${actual.repartidor_id}:${actual.jornada_id}`}
                    registro={actual}
                    ahora={ahora}
                    actualizado={consulta.actualizado ?? 0}
                    cerrar={() => {
                      setSeleccionado(null);
                      requestAnimationFrame(() => lista.current?.focus());
                    }}
                  />
                ) : (
                  <Panel titulo="Información del motorista">
                    <div className="monitor-mapa-estado">
                      <Bike size={36} aria-hidden="true" />
                      <h3>Selecciona un motorista</h3>
                      <p>
                        Toca un punto del mapa o un motorista del listado para
                        consultar sus solicitudes, tubos, frascos y vehículo.
                      </p>
                    </div>
                  </Panel>
                )}
              </div>
            </div>
          </>
        )
      )}
    </>
  );
}
