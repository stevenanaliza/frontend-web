import { useSearchParams } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "./auth";
import { sucursalSchema } from "./contratos-admin";
import {
  Cabecera,
  SelectorEmpresa,
  TablaRemota,
  usePaginaRemota,
} from "./admin-comunes";
import { Etiqueta, Panel } from "./componentes";
import { NuevaSucursal } from "./Altas";
import { Exito } from "./formularios";
import { empresaDeConsulta, puedeElegirEmpresa } from "./permisos";

export function Sucursales() {
  const { perfil } = useAuth();
  const [params, setParams] = useSearchParams();
  const empresa = empresaDeConsulta(perfil, params.get("empresa_id"));
  const [nueva, setNueva] = useState(params.get("crear") === "1"),
    [revision, setRevision] = useState(0),
    [mensaje, setMensaje] = useState("");
  return (
    <>
      <Cabecera
        titulo="Sucursales"
        texto="Sedes autorizadas de la empresa y ubicaciones registradas."
        accion={
          empresa && perfil?.permisos.includes("sucursal.administrar") ? (
            <button className="boton primario" onClick={() => setNueva(!nueva)}>
              Crear sucursal
            </button>
          ) : undefined
        }
      />
      {!empresa ? (
        <SelectorEmpresa seleccionar={(id) => setParams({ empresa_id: id })} />
      ) : (
        <>
          <div className="franja-contexto">
            <div>
              <strong>
                {perfil?.empresa?.id === empresa
                  ? perfil.empresa.nombre
                  : "Empresa seleccionada"}
              </strong>
              <span>Solo se muestran las sucursales dentro de tu alcance.</span>
            </div>
            {puedeElegirEmpresa(perfil) && (
              <button
                className="boton secundario"
                onClick={() => setParams({})}
              >
                Cambiar empresa
              </button>
            )}
          </div>
          {mensaje && <Exito>{mensaje}</Exito>}
          {nueva && perfil?.permisos.includes("sucursal.administrar") && (
            <NuevaSucursal
              key={empresa}
              empresa={empresa}
              cerrar={() => setNueva(false)}
              creada={() => {
                setNueva(false);
                setMensaje("Sucursal creada.");
                setRevision((v) => v + 1);
              }}
            />
          )}
          <ListaSucursales key={`${empresa}:${revision}`} empresa={empresa} />
        </>
      )}
    </>
  );
}
function ListaSucursales({ empresa }: { empresa: string }) {
  const listado = usePaginaRemota(
    `/api/v1/organizaciones/empresas/${encodeURIComponent(empresa)}/sucursales/`,
    sucursalSchema,
  );
  return (
    <Panel
      titulo="Directorio de sucursales"
      extra={
        <button
          className="boton secundario"
          disabled={listado.cargando}
          onClick={listado.recargar}
        >
          Actualizar
        </button>
      }
    >
      <TablaRemota
        consulta={listado}
        tituloVacio="Sin sucursales visibles en esta empresa"
      >
        {(items) => (
          <div
            className="tabla-scroll"
            role="region"
            aria-label="Sucursales"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Sucursal</th>
                  <th>Ubicación</th>
                  <th>Contacto</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.nombre}</strong>
                      <small>{s.codigo}</small>
                    </td>
                    <td className="celda-texto">
                      {s.ubicacion.nombre}
                      <small>{s.ubicacion.direccion}</small>
                    </td>
                    <td>
                      {s.telefono ?? "Sin teléfono"}
                      <small>{s.correo ?? "Sin correo"}</small>
                    </td>
                    <td>
                      <Etiqueta tono={s.estado === "ACTIVO" ? "verde" : ""}>
                        {s.estado === "ACTIVO"
                          ? "Activa"
                          : s.estado === "INACTIVO"
                            ? "Inactiva"
                            : s.estado}
                      </Etiqueta>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TablaRemota>
    </Panel>
  );
}
