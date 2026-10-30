import { Link, useSearchParams } from "react-router-dom";
import {
  Cabecera,
  Filtros,
  TablaRemota,
  usePaginaRemota,
} from "./admin-comunes";
import { motoristaSchema } from "./contratos-admin";
import { Etiqueta, Panel, estados } from "./componentes";
import { EstadoAlmuerzo } from "./EstadoAlmuerzo";

export default function Almuerzos() {
  const [params] = useSearchParams();
  const filtro = params.get("en_almuerzo") ?? "";
  const listado = usePaginaRemota("/api/v1/repartidores/", motoristaSchema, {
    empresa_id: params.get("empresa_id") ?? "",
    en_almuerzo: filtro,
    activo: params.get("activo") ?? "",
  });
  return (
    <>
      <Cabecera
        titulo="Almuerzos"
        texto="Revisa quién está almorzando y la hora de inicio reportada."
        recargar={listado.recargar}
        cargando={listado.cargando}
        accion={
          <Link className="boton secundario" to="/motoristas">
            Ver motoristas
          </Link>
        }
      />
      <Filtros empresa error={listado.error}>
        <label htmlFor="en_almuerzo">
          Almuerzo
          <select id="en_almuerzo" name="en_almuerzo" defaultValue={filtro}>
            <option value="">Todos</option>
            <option value="true">En almuerzo</option>
            <option value="false">Fuera de almuerzo</option>
          </select>
        </label>
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
      </Filtros>
      <Panel titulo="Estado actual de almuerzos">
        <p className="panel-nota">
          El motorista registra su salida y regreso. Una pausa general no se
          considera almuerzo.
        </p>
        <TablaRemota
          consulta={listado}
          tituloVacio="Sin motoristas para estos filtros"
        >
          {(items) => (
            <>
              {items.some((m) => m.en_almuerzo === undefined) && (
                <p className="aviso" role="status">
                  {filtro
                    ? "El servidor todavía no informa el estado de almuerzo. No se puede confirmar que haya aplicado este filtro."
                    : "El servidor no informa el estado de almuerzo de algunos motoristas. Se muestran sin información."}
                </p>
              )}
              <ul
                className="almuerzos-lista"
                aria-label="Almuerzos de motoristas"
              >
                {items.map((m) => (
                  <li key={m.id}>
                    <h3>
                      {m.usuario.nombres} {m.usuario.apellidos}
                    </h3>
                    <p className="almuerzo-correo">{m.usuario.correo}</p>
                    <EstadoAlmuerzo motorista={m} />
                    <div className="almuerzo-perfil">
                      <Etiqueta>
                        {estados[m.estado_operativo] ?? m.estado_operativo}
                      </Etiqueta>
                      <span>
                        {m.activo ? "Perfil activo" : "Perfil inactivo"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </TablaRemota>
      </Panel>
    </>
  );
}
