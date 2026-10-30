import { cantidad } from "./carga";
import { useState, type FormEvent } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Filter,
  RefreshCw,
  Users,
  CalendarDays,
  Info,
  X,
} from "lucide-react";
import { api, consulta, parsear } from "./api";
import { useAuth } from "./auth";
import { empresaDeConsulta, puedeElegirEmpresa } from "./permisos";
import { paginaSchema, resumenSchema } from "./contratos";
import {
  Cargando,
  ErrorCampo,
  ErrorVista,
  Etiqueta,
  Paginacion,
  Vacio,
  numero,
  temperatura,
  useConsulta,
  fecha,
  fechaHora,
} from "./componentes";

export function Resumenes() {
  const { perfil } = useAuth();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const filtros = {
    fecha_operativa: params.get("fecha_operativa") ?? "",
    empresa_id: empresaDeConsulta(perfil, params.get("empresa_id")),
    repartidor_id: params.get("repartidor_id") ?? "",
    activo: params.get("activo") ?? "",
    pagina: Math.max(1, Number(params.get("pagina")) || 1),
    tamano_pagina: [20, 50, 100].includes(Number(params.get("tamano_pagina")))
      ? Number(params.get("tamano_pagina"))
      : 20,
  };
  const [avanzados, setAvanzados] = useState(
    Boolean(
      (puedeElegirEmpresa(perfil) && filtros.empresa_id) ||
      filtros.repartidor_id,
    ),
  );
  const ruta = `/api/v1/repartidores/resumenes/${consulta(filtros)}`;
  const { datos, cargando, error, recargar } = useConsulta(
    async (signal) =>
      parsear(
        paginaSchema(resumenSchema),
        await api.solicitar(ruta, { signal }),
      ),
    ruta,
  );
  function filtrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const siguientes = new URLSearchParams();
    form.forEach((valor, clave) => {
      if (valor !== "") siguientes.set(clave, String(valor));
    });
    if (!puedeElegirEmpresa(perfil)) siguientes.delete("empresa_id");
    setParams(siguientes);
  }
  function cambiarPagina(pagina: number) {
    const siguientes = new URLSearchParams(params);
    siguientes.set("pagina", String(pagina));
    setParams(siguientes);
  }
  return (
    <>
      <div className="pagina-cabecera">
        <div>
          <h1>Resúmenes diarios</h1>
          <p>La actividad de cada motorista, con el detalle que necesitas.</p>
        </div>
        <button
          className="boton secundario"
          disabled={cargando}
          onClick={recargar}
        >
          <RefreshCw
            size={17}
            className={cargando ? "girar" : ""}
            aria-hidden="true"
          />
          Actualizar
        </button>
      </div>
      <div className="franja-contexto">
        <CalendarDays size={20} aria-hidden="true" />
        <div>
          <strong>
            {filtros.fecha_operativa
              ? fecha(filtros.fecha_operativa)
              : "Hoy, según la zona operativa de cada motorista"}
          </strong>
          <span>Actividad diaria · Kilometraje de jornadas cerradas</span>
        </div>
        <Etiqueta>Solo consulta</Etiqueta>
      </div>
      <section className="panel filtros" aria-label="Filtros de resúmenes">
        <form key={location.search} onSubmit={filtrar}>
          <div className="filtros-fila">
            <label htmlFor="fecha_operativa">
              Fecha operativa
              <input
                id="fecha_operativa"
                name="fecha_operativa"
                type="date"
                max="9999-12-30"
                defaultValue={filtros.fecha_operativa}
              />
              <ErrorCampo error={error} campo="fecha_operativa" />
            </label>
            <label htmlFor="activo">
              Estado del perfil
              <select id="activo" name="activo" defaultValue={filtros.activo}>
                <option value="">Todos los perfiles</option>
                <option value="true">Activos</option>
                <option value="false">Inactivos</option>
              </select>
              <ErrorCampo error={error} campo="activo" />
            </label>
            <label htmlFor="tamano_pagina">
              Filas por página
              <select
                id="tamano_pagina"
                name="tamano_pagina"
                defaultValue={filtros.tamano_pagina}
              >
                <option>20</option>
                <option>50</option>
                <option>100</option>
              </select>
            </label>
            <button
              type="button"
              className="boton secundario"
              aria-expanded={avanzados}
              aria-controls="filtros-avanzados"
              onClick={() => setAvanzados(!avanzados)}
            >
              <Filter size={16} aria-hidden="true" />
              Más filtros
            </button>
            <button className="boton primario">Aplicar filtros</button>
            {params.size > 0 && (
              <button
                type="button"
                className="boton texto"
                onClick={() => setParams({})}
              >
                <X size={16} aria-hidden="true" />
                Limpiar
              </button>
            )}
          </div>
          <div
            id="filtros-avanzados"
            className="filtros-avanzados"
            hidden={!avanzados}
          >
            {(puedeElegirEmpresa(perfil)
              ? (["empresa_id", "repartidor_id"] as const)
              : (["repartidor_id"] as const)
            ).map((campo) => (
              <label key={campo} htmlFor={campo}>
                {campo === "empresa_id" ? "ID de empresa" : "ID de motorista"}
                <input
                  id={campo}
                  name={campo}
                  defaultValue={filtros[campo]}
                  placeholder="UUID"
                  pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
                  title="Introduce un UUID válido"
                />
                <ErrorCampo error={error} campo={campo} />
              </label>
            ))}
          </div>
        </form>
      </section>
      <section className="panel">
        <div className="panel-cabecera">
          <div className="titulo-icono">
            <Users size={19} aria-hidden="true" />
            <h2>Actividad por motorista</h2>
            {datos && <span className="contador">{numero(datos.conteo)}</span>}
          </div>
          <span className="muted pequeno">
            Cada hito se contabiliza por separado
          </span>
        </div>
        {cargando ? (
          <Cargando />
        ) : error ? (
          <ErrorVista error={error} reintentar={recargar} />
        ) : (
          datos && (
            <>
              {datos.resultados.length === 0 ? (
                <Vacio titulo="Sin motoristas para estos filtros" />
              ) : (
                <div
                  className="tabla-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label="Resúmenes de motoristas"
                >
                  <table>
                    <caption className="sr-only">
                      Actividad del día seleccionado por motorista; las etapas
                      son independientes.
                    </caption>
                    <thead>
                      <tr>
                        <th>Motorista</th>
                        <th>
                          Solicitudes
                          <small>Asignadas / recogidas / entregadas</small>
                        </th>
                        <th>
                          Tubos<small>Recogidos / entregados conocidos</small>
                        </th>
                        <th>
                          Frascos<small>Recogidos / entregados conocidos</small>
                        </th>
                        <th>
                          Temperatura<small>Promedio de recolecciones</small>
                        </th>
                        <th>
                          Km de jornadas cerradas
                          <small>Medidos / consolidados</small>
                        </th>
                        <th>
                          <span className="sr-only">Detalle</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {datos.resultados.map((resumen) => (
                        <tr key={resumen.repartidor.id}>
                          <td>
                            <Link
                              className="motorista-link"
                              state={{ volver: location.search }}
                              to={`/motoristas/${resumen.repartidor.id}?fecha_operativa=${resumen.fecha_operativa}`}
                            >
                              <span className="avatar">
                                {resumen.repartidor.nombres.charAt(0)}
                                {resumen.repartidor.apellidos.charAt(0)}
                              </span>
                              <span>
                                <strong>
                                  {resumen.repartidor.nombres}{" "}
                                  {resumen.repartidor.apellidos}
                                </strong>
                                <small>
                                  {resumen.repartidor.empresa_nombre ??
                                    "Sin empresa"}{" "}
                                  ·{" "}
                                  {resumen.repartidor.activo
                                    ? "Activo"
                                    : "Inactivo"}
                                </small>
                                <small>{fecha(resumen.fecha_operativa)}</small>
                              </span>
                            </Link>
                          </td>
                          <td>
                            <div className="datos-paralelos">
                              <span>
                                {numero(resumen.solicitudes.asignadas)}
                              </span>
                              <span>
                                {numero(resumen.solicitudes.recolectadas)}
                              </span>
                              <span>
                                {numero(resumen.solicitudes.entregadas)}
                              </span>
                            </div>
                            <small>
                              {resumen.solicitudes.fallidas} fallidas ·{" "}
                              {resumen.solicitudes.canceladas} canceladas
                            </small>
                          </td>
                          <td>
                            <strong>
                              {numero(resumen.tubos.recogidos_conocidos)} /{" "}
                              {numero(resumen.tubos.entregados_conocidos)}
                            </strong>
                            {(resumen.tubos.recolecciones_sin_cantidad > 0 ||
                              resumen.tubos.entregas_sin_cantidad > 0) && (
                              <small className="advertencia-texto">
                                Datos parciales · cantidades sin declarar
                              </small>
                            )}
                          </td>
                          <td>
                            <strong>
                              {cantidad(resumen.frascos?.recogidos_conocidos)} /{" "}
                              {cantidad(resumen.frascos?.entregados_conocidos)}
                            </strong>
                            <small>
                              {cantidad(
                                resumen.frascos?.recolecciones_sin_cantidad,
                              )}{" "}
                              recolecciones sin cantidad
                            </small>
                            <small>
                              {cantidad(resumen.frascos?.entregas_sin_cantidad)}{" "}
                              entregas sin cantidad
                            </small>
                          </td>
                          <td>
                            <strong>
                              {temperatura(resumen.temperaturas.promedio_c)}
                            </strong>
                            <small>
                              {resumen.temperaturas.lecturas_con_temperatura}{" "}
                              con lectura ·{" "}
                              {resumen.temperaturas.lecturas_sin_temperatura}{" "}
                              sin lectura
                            </small>
                          </td>
                          <td>
                            <strong>
                              {numero(
                                resumen.kilometraje.kilometros_medidos,
                                3,
                              )}{" "}
                              /{" "}
                              {numero(
                                resumen.kilometraje.kilometros_consolidados,
                                3,
                              )}
                            </strong>
                            <div>
                              <Etiqueta
                                tono={
                                  resumen.kilometraje.completo
                                    ? "verde"
                                    : "ambar"
                                }
                              >
                                {resumen.kilometraje.completo
                                  ? "Completo"
                                  : "Incompleto"}
                              </Etiqueta>
                            </div>
                          </td>
                          <td>
                            <Link
                              className="boton icono"
                              aria-label={`Ver detalle de ${resumen.repartidor.nombres} ${resumen.repartidor.apellidos}`}
                              state={{ volver: location.search }}
                              to={`/motoristas/${resumen.repartidor.id}?fecha_operativa=${resumen.fecha_operativa}`}
                            >
                              <ArrowRight size={19} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Paginacion
                datos={datos}
                pagina={filtros.pagina}
                tamano={filtros.tamano_pagina}
                cambiar={cambiarPagina}
              />
              {datos.resultados[0] && (
                <div className="panel-nota">
                  Generado:{" "}
                  {fechaHora(
                    datos.resultados[0].generado_en,
                    datos.resultados[0].zona_horaria_operativa,
                  )}{" "}
                  · {datos.resultados[0].zona_horaria_operativa}
                </div>
              )}
            </>
          )
        )}
      </section>
      <div className="nota-informativa">
        <Info size={18} aria-hidden="true" />
        <p>
          Los kilómetros corresponden a jornadas cerradas. Las cantidades
          conocidas de tubos y frascos pueden ser parciales cuando existen
          históricos sin declarar. Consulta el detalle para ver la carga actual.
        </p>
      </div>
    </>
  );
}
