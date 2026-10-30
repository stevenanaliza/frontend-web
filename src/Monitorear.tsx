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
import { api, parsear } from "./api";
import { detalleSolicitudSchema, estadosSolicitud } from "./contratos-admin";
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
import { estadoGps, type MotoristaMonitor } from "./monitoreo";
import "./monitoreo.css";
import { EstadoAlmuerzo } from "./EstadoAlmuerzo";
import { coincideAlmuerzo, type FiltroAlmuerzo } from "./almuerzos";

const MapaMotoristas = lazy(() => import("./MapaMotoristas"));
const hora = (valor: string | number) =>
  new Intl.DateTimeFormat("es-HN", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Tegucigalpa",
  }).format(new Date(valor));

function FichaMotorista({
  registro,
  actualizado,
  cerrar,
}: {
  registro: MotoristaMonitor;
  actualizado: number;
  cerrar: () => void;
}) {
  const { motorista: m, solicitudes, punto } = registro;
  const ids = solicitudes
    .map((s) => s.id)
    .sort()
    .join(",");
  const detalle = useConsulta(
    async (signal) =>
      Promise.all(
        solicitudes.map(async (s) => {
          const datos = parsear(
            detalleSolicitudSchema,
            await api.solicitar(
              `/api/v1/solicitudes/${encodeURIComponent(s.id)}/`,
              { signal },
            ),
          );
          if (datos.id !== s.id || datos.repartidor_asignado_id !== m.id)
            throw new Error("La asignación cambió; actualiza el monitoreo.");
          return datos;
        }),
      ),
    `monitor-carga:${m.id}:${ids}:${actualizado}`,
  );
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
        <h3>
          {m.usuario.nombres} {m.usuario.apellidos}
        </h3>
        <div className="acciones">
          <Etiqueta>
            {estados[m.estado_operativo] ?? m.estado_operativo}
          </Etiqueta>
          <Etiqueta>{estados[m.capacidad] ?? m.capacidad}</Etiqueta>
          {!m.activo && <Etiqueta tono="ambar">Perfil inactivo</Etiqueta>}
        </div>
        <div className="monitor-almuerzo">
          <EstadoAlmuerzo motorista={m} />
        </div>
        <p className="ayuda-form">
          {registro.errorGps
            ? "No se pudo consultar el GPS de este motorista."
            : punto
              ? `Última captura: ${hora(punto.registrada_en)} (hora de Honduras).`
              : "Sin ubicación disponible durante una solicitud activa."}
        </p>
        {punto && (
          <p className="ayuda-form">
            Precisión reportada:{" "}
            {punto.precision_metros === null
              ? "sin dato"
              : `${numero(punto.precision_metros, 1)} metros`}
            .
          </p>
        )}
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
        <h3>Solicitudes y carga</h3>
        <p className="ayuda-form">
          La carga total la calcula el servidor. Este listado incluye las
          solicitudes activas dentro de tu alcance.
        </p>
        {!solicitudes.length ? (
          <p>No hay solicitudes activas visibles.</p>
        ) : (
          <>
            {detalle.cargando && <Cargando texto="Consultando solicitudes…" />}
            {detalle.error != null && (
              <ErrorVista error={detalle.error} reintentar={detalle.recargar} />
            )}
            <ul className="monitor-solicitudes">
              {solicitudes.map((s) => {
                const completa = detalle.datos?.find((d) => d.id === s.id);
                return (
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
                    {completa && completa.articulos_historicos.length > 0 && (
                      <Link to={`/solicitudes/${s.id}`}>
                        Ver artículos históricos en el detalle
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </Panel>
  );
}

export default function Monitorear() {
  const consulta = useMonitoreo();
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [buscar, setBuscar] = useState("");
  const [almuerzo, setAlmuerzo] = useState<FiltroAlmuerzo>("");
  const [encuadre, setEncuadre] = useState(0);
  const [ahora, setAhora] = useState(Date.now());
  const ficha = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const timer = setInterval(() => setAhora(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);
  const registros = consulta.datos ?? [];
  const visibles = registros.filter(
    ({ motorista: m }) =>
      coincideAlmuerzo(m, almuerzo) &&
      `${m.usuario.nombres} ${m.usuario.apellidos} ${m.vehiculo?.placa ?? ""}`
        .toLocaleLowerCase("es")
        .includes(buscar.trim().toLocaleLowerCase("es")),
  );
  const ubicados = visibles.filter(
    (r) =>
      r.punto && estadoGps(r.punto, ahora) !== "Fecha de GPS por verificar",
  );
  const actual = visibles.find((r) => r.motorista.id === seleccionado);
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
            : consulta.error || registros.some((r) => r.errorGps)
              ? "Actualización pausada por un error; pulsa Actualizar para reintentar"
              : consulta.cargando
                ? "Consultando motoristas y ubicaciones…"
                : consulta.automatico
                  ? "Actualización automática cada 15 segundos"
                  : "Actualización automática pausada"}
          {consulta.actualizado &&
            ` · Última consulta: ${hora(consulta.actualizado)}`}
        </span>
      </div>
      <p className="ayuda-form monitor-explicacion">
        Los puntos muestran la última captura GPS disponible durante solicitudes
        activas. Una ubicación antigua no confirma dónde está ahora el
        motorista.
      </p>
      {consulta.error != null && (
        <ErrorVista error={consulta.error} reintentar={consulta.recargar} />
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
                Buscar motorista o placa
              </label>
              <input
                id="buscar-motorista-monitor"
                type="search"
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
                placeholder="Nombre, apellido o placa"
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
                  <option value="sin_dato">Sin información</option>
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
                      Ubicación reciente (hasta 2 minutos)
                    </span>
                    <span>
                      <i className="monitor-indicador antiguo" />
                      Ubicación antigua
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
                          <li key={r.motorista.id}>
                            <button
                              aria-pressed={seleccionado === r.motorista.id}
                              onClick={() => seleccionar(r.motorista.id)}
                            >
                              <Bike size={22} aria-hidden="true" />
                              <span>
                                <strong>
                                  {r.motorista.usuario.nombres}{" "}
                                  {r.motorista.usuario.apellidos}
                                </strong>
                                <small>
                                  {estados[r.motorista.estado_operativo] ??
                                    r.motorista.estado_operativo}{" "}
                                  · {numero(r.motorista.solicitudes_activas)}{" "}
                                  solicitudes ·{" "}
                                  {numero(r.motorista.tubos_en_transporte)}{" "}
                                  tubos en transporte ·{" "}
                                  {cantidad(r.motorista.frascos_en_transporte)}{" "}
                                  frascos en transporte
                                </small>
                                <small>
                                  {r.errorGps
                                    ? "No se pudo consultar el GPS"
                                    : estadoGps(r.punto, ahora)}
                                  {r.punto
                                    ? ` · ${hora(r.punto.registrada_en)}`
                                    : ""}
                                </small>
                                <EstadoAlmuerzo
                                  motorista={r.motorista}
                                  compacto
                                />
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
                    key={actual.motorista.id}
                    registro={actual}
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
