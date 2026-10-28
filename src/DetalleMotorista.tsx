import {
  Link,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Thermometer,
  CalendarDays,
  Clock,
  RefreshCw,
  Info,
  Package,
  Route,
} from "lucide-react";
import { api, consulta, parsear } from "./api";
import {
  lecturaSchema,
  paginaSchema,
  resumenSchema,
  type Resumen,
} from "./contratos";
import {
  Cargando,
  ErrorVista,
  Etiqueta,
  Metrica,
  Paginacion,
  Panel,
  Vacio,
  estados,
  fecha,
  fechaHora,
  numero,
  temperatura,
  useConsulta,
} from "./componentes";

function Actividad({ resumen }: { resumen: Resumen }) {
  const { solicitudes, tubos, kilometraje: km, temperaturas: temp } = resumen;
  return (
    <>
      <Panel
        titulo="Actividad del día"
        extra={<Etiqueta>{fecha(resumen.fecha_operativa)}</Etiqueta>}
      >
        <div className="metricas cinco">
          {Object.entries(solicitudes).map(([clave, valor]) => (
            <Metrica
              key={clave}
              etiqueta={
                (
                  {
                    asignadas: "Asignadas",
                    recolectadas: "Recolectadas",
                    entregadas: "Entregadas",
                    fallidas: "Fallidas",
                    canceladas: "Canceladas",
                  } as Record<string, string>
                )[clave]
              }
              valor={numero(valor)}
            />
          ))}
        </div>
        <div className="panel-nota">
          Hitos independientes de solicitudes; no representan un total sumable.
        </div>
        <div className="metricas dos borde-arriba">
          <Metrica
            etiqueta="Tubos recogidos conocidos"
            valor={numero(tubos.recogidos_conocidos)}
            nota={`${tubos.recolecciones_sin_cantidad} recolecciones sin cantidad declarada`}
          />
          <Metrica
            etiqueta="Tubos entregados conocidos"
            valor={numero(tubos.entregados_conocidos)}
            nota={`${tubos.entregas_sin_cantidad} entregas sin cantidad declarada`}
          />
        </div>
        {(tubos.recolecciones_sin_cantidad > 0 ||
          tubos.entregas_sin_cantidad > 0) && (
          <div className="aviso compacto">
            Cantidades parciales: los tubos desconocidos no están incluidos en
            estas sumas.
          </div>
        )}
      </Panel>
      <div className="detalle-dos">
        <Panel
          titulo="Km de jornadas cerradas"
          extra={<Route size={19} aria-hidden="true" />}
        >
          <div className="metricas dos">
            <Metrica
              etiqueta="Medidos"
              valor={numero(km.kilometros_medidos, 3)}
              nota="km con medición disponible"
            />
            <Metrica
              etiqueta="Consolidados"
              valor={numero(km.kilometros_consolidados, 3)}
              nota="km con calidad consolidada"
            />
          </div>
          <div className="panel-interior">
            <Etiqueta tono={km.completo ? "verde" : "ambar"}>
              {km.completo ? "Información completa" : "Información incompleta"}
            </Etiqueta>
            <dl className="definiciones">
              <div>
                <dt>Jornadas cerradas</dt>
                <dd>{km.jornadas_cerradas}</dd>
              </div>
              <div>
                <dt>Con medición</dt>
                <dd>{km.jornadas_con_medicion}</dd>
              </div>
              <div>
                <dt>Consolidadas</dt>
                <dd>{km.jornadas_consolidadas}</dd>
              </div>
              <div>
                <dt>Sin cierre en el periodo</dt>
                <dd>{km.jornadas_sin_cierre_en_periodo}</dd>
              </div>
            </dl>
          </div>
          <p className="panel-nota">
            La distancia íntegra corresponde al periodo de cierre de la jornada.
            No representa seguimiento en tiempo real.
          </p>
        </Panel>
        <Panel
          titulo="Temperaturas de recolección"
          extra={<Thermometer size={19} aria-hidden="true" />}
        >
          <div className="metricas tres">
            <Metrica etiqueta="Mínima" valor={temperatura(temp.minima_c)} />
            <Metrica etiqueta="Promedio" valor={temperatura(temp.promedio_c)} />
            <Metrica etiqueta="Máxima" valor={temperatura(temp.maxima_c)} />
          </div>
          <div className="panel-interior">
            <dl className="definiciones">
              <div>
                <dt>Registros de recolección</dt>
                <dd>{temp.lecturas_registradas}</dd>
              </div>
              <div>
                <dt>Con temperatura</dt>
                <dd>{temp.lecturas_con_temperatura}</dd>
              </div>
              <div>
                <dt>Sin temperatura</dt>
                <dd>{temp.lecturas_sin_temperatura}</dd>
              </div>
            </dl>
          </div>
          <p className="panel-nota">
            Lecturas registradas por recolección. No se ha definido un rango
            clínico aceptable.
          </p>
        </Panel>
      </div>
    </>
  );
}
function CargaActual({ resumen }: { resumen: Resumen }) {
  const carga = resumen.carga_actual;
  return (
    <Panel
      titulo="Carga actual"
      className="carga-panel"
      extra={<Etiqueta tono="azul">Al consultar</Etiqueta>}
    >
      <p className="panel-nota">
        Situación actual del motorista, independiente de la fecha seleccionada.
        Los límites son compartidos por empresa o red y el cupo es individual
        para cada motorista.
      </p>
      <div className="carga-estado">
        <Package size={25} aria-hidden="true" />
        <div>
          <strong>{estados[carga.capacidad] ?? carga.capacidad}</strong>
          <span>
            {estados[carga.estado_operativo] ?? carga.estado_operativo}
          </span>
        </div>
      </div>
      <div className="carga-cantidad">
        <strong>{numero(carga.tubos_comprometidos)}</strong>
        <span>/ {numero(carga.limite_tubos)} tubos comprometidos</span>
      </div>
      {carga.solicitudes_sin_cantidad_tubos > 0 ? (
        <div className="aviso compacto">
          <strong>Carga parcial</strong>
          <p>
            {carga.solicitudes_sin_cantidad_tubos} solicitudes activas sin
            cantidad de tubos. La carga conocida no es el total exacto.
          </p>
        </div>
      ) : null}
      <dl className="definiciones carga-definiciones">
        <div>
          <dt>En transporte</dt>
          <dd>{numero(carga.tubos_en_transporte)} tubos</dd>
        </div>
        <div>
          <dt>Reservados</dt>
          <dd>{numero(carga.tubos_reservados)} tubos</dd>
        </div>
        <div>
          <dt>Disponibles</dt>
          <dd>{numero(carga.tubos_disponibles)} tubos</dd>
        </div>
        <div>
          <dt>Solicitudes activas</dt>
          <dd>
            {numero(carga.solicitudes_activas)} /{" "}
            {numero(carga.limite_solicitudes)}
          </dd>
        </div>
      </dl>
      <div className="carga-disponibilidad">
        <span
          className={`punto ${carga.puede_recibir_solicitudes ? "verde" : ""}`}
        />
        {carga.puede_recibir_solicitudes
          ? "Puede recibir solicitudes"
          : "No puede recibir solicitudes"}
      </div>
      <p className="panel-nota">
        Capacidad y disponibilidad calculadas por el backend.
      </p>
    </Panel>
  );
}
function Temperaturas({
  id,
  dia,
  zona,
}: {
  id: string;
  dia: string;
  zona: string;
}) {
  const [params, setParams] = useSearchParams();
  const pagina = Math.max(1, Number(params.get("pagina_temperaturas")) || 1);
  const tamano = [20, 50, 100].includes(
    Number(params.get("tamano_temperaturas")),
  )
    ? Number(params.get("tamano_temperaturas"))
    : 20;
  const ruta = `/api/v1/repartidores/${encodeURIComponent(id)}/temperaturas/${consulta({ fecha_operativa: dia, pagina, tamano_pagina: tamano })}`;
  const { datos, error, cargando, recargar } = useConsulta(
    async (signal) =>
      parsear(
        paginaSchema(lecturaSchema),
        await api.solicitar(ruta, { signal }),
      ),
    ruta,
  );
  return (
    <Panel
      titulo="Lecturas de temperatura"
      extra={
        <label className="selector-filas" htmlFor="tamano_temperaturas">
          Filas
          <select
            id="tamano_temperaturas"
            value={tamano}
            onChange={(event) => {
              const nuevo = new URLSearchParams(params);
              nuevo.set("tamano_temperaturas", event.target.value);
              nuevo.delete("pagina_temperaturas");
              setParams(nuevo);
            }}
          >
            <option>20</option>
            <option>50</option>
            <option>100</option>
          </select>
        </label>
      }
    >
      {cargando ? (
        <Cargando texto="Consultando lecturas…" />
      ) : error ? (
        <ErrorVista error={error} reintentar={recargar} />
      ) : (
        datos && (
          <>
            {datos.resultados.length === 0 ? (
              <Vacio
                titulo="Sin lecturas de recolección"
                texto="No se registraron lecturas en el día seleccionado."
              />
            ) : (
              <div
                className="tabla-scroll"
                role="region"
                aria-label="Lecturas de temperatura"
                tabIndex={0}
              >
                <table>
                  <caption className="sr-only">
                    Temperaturas del día {dia}, zona {zona}
                  </caption>
                  <thead>
                    <tr>
                      <th>Solicitud</th>
                      <th>Temperatura del contenedor</th>
                      <th>Fuente</th>
                      <th>Fecha y hora de captura</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.resultados.map((lectura) => (
                      <tr key={lectura.id}>
                        <td>
                          <strong>{lectura.numero_solicitud}</strong>
                          <small
                            className="id-dato"
                            title={lectura.solicitud_id}
                          >
                            {lectura.solicitud_id}
                          </small>
                        </td>
                        <td>
                          <strong>
                            {temperatura(lectura.temperatura_contenedor_c)}
                          </strong>
                          {lectura.temperatura_contenedor_c === null && (
                            <small>Histórico sin temperatura</small>
                          )}
                        </td>
                        <td>
                          <Etiqueta>
                            {lectura.fuente_temperatura === "MANUAL"
                              ? "Manual"
                              : lectura.fuente_temperatura === "AUTOMATICA"
                                ? "Automática"
                                : (lectura.fuente_temperatura ??
                                  "Sin registrar")}
                          </Etiqueta>
                        </td>
                        <td>
                          {fechaHora(lectura.capturada_en, zona)}
                          <small>{zona}</small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Paginacion
              datos={datos}
              pagina={pagina}
              tamano={tamano}
              cambiar={(nueva) => {
                const siguiente = new URLSearchParams(params);
                siguiente.set("pagina_temperaturas", String(nueva));
                setParams(siguiente);
              }}
            />
          </>
        )
      )}
    </Panel>
  );
}
export function DetalleMotorista() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const dia = params.get("fecha_operativa") ?? "";
  const ruta = `/api/v1/repartidores/${encodeURIComponent(id)}/resumen/${consulta({ fecha_operativa: dia })}`;
  const { datos, cargando, error, recargar } = useConsulta(
    async (signal) =>
      parsear(resumenSchema, await api.solicitar(ruta, { signal })),
    ruta,
  );
  const volver =
    typeof location.state?.volver === "string" ? location.state.volver : "";
  return (
    <>
      <Link to={`/resumenes${volver}`} className="enlace-volver">
        <ArrowLeft size={17} aria-hidden="true" />
        Volver a resúmenes diarios
      </Link>
      <div className="pagina-cabecera">
        <div>
          <h1>
            {datos
              ? `${datos.repartidor.nombres} ${datos.repartidor.apellidos}`
              : "Detalle del motorista"}
          </h1>
          <p>
            {datos
              ? `${datos.repartidor.empresa_nombre ?? "Sin empresa"} · ${datos.repartidor.activo ? "Perfil activo" : "Perfil inactivo"}`
              : "Actividad diaria, carga actual y lecturas de temperatura."}
          </p>
        </div>
        <button
          className="boton secundario"
          disabled={cargando}
          onClick={recargar}
        >
          <RefreshCw size={17} aria-hidden="true" />
          Actualizar resumen
        </button>
      </div>
      <div className="detalle-fecha panel">
        <CalendarDays size={19} aria-hidden="true" />
        <label htmlFor="fecha_operativa">Fecha operativa</label>
        <input
          id="fecha_operativa"
          type="date"
          max="9999-12-30"
          value={dia}
          onChange={(event) => {
            const nuevo = new URLSearchParams();
            if (event.target.value)
              nuevo.set("fecha_operativa", event.target.value);
            setParams(nuevo, { state: location.state });
          }}
        />
        {datos && (
          <span className="muted pequeno">{datos.zona_horaria_operativa}</span>
        )}
      </div>
      {cargando ? (
        <Cargando />
      ) : error ? (
        <ErrorVista error={error} reintentar={recargar} />
      ) : (
        datos && (
          <>
            <div className="periodo">
              <Clock size={16} aria-hidden="true" />
              <span>
                {fechaHora(datos.periodo.desde, datos.zona_horaria_operativa)}{" "}
                <ArrowRight size={13} aria-hidden="true" />{" "}
                {fechaHora(
                  datos.periodo.hasta_exclusivo,
                  datos.zona_horaria_operativa,
                )}{" "}
                (fin exclusivo)
              </span>
            </div>
            <div className="detalle-layout">
              <div className="detalle-actividad">
                <Actividad resumen={datos} />
              </div>
              <aside aria-label="Carga actual del motorista">
                <CargaActual resumen={datos} />
              </aside>
            </div>
            <Temperaturas
              key={`${id}:${datos.fecha_operativa}`}
              id={id}
              dia={datos.fecha_operativa}
              zona={datos.zona_horaria_operativa}
            />
            <div className="nota-informativa">
              <Info size={18} aria-hidden="true" />
              <p>
                Resumen generado el{" "}
                {fechaHora(datos.generado_en, datos.zona_horaria_operativa)}.
                Los históricos sin datos conservan su estado desconocido.
              </p>
            </div>
          </>
        )
      )}
    </>
  );
}
