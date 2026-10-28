import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "./auth";
import { vehiculoSchema } from "./contratos-admin";
import { Cabecera, TablaRemota, usePaginaRemota } from "./admin-comunes";
import { EmpresaCampo, Exito } from "./formularios";
import { Etiqueta, Panel } from "./componentes";
import { NuevoVehiculo } from "./Altas";

export function Vehiculos() {
  const { perfil } = useAuth();
  const [params, setParams] = useSearchParams();
  const empresa = params.get("empresa_id") ?? perfil?.empresa?.id ?? "";
  const [nuevo, setNuevo] = useState(params.get("crear") === "1");
  const [mensaje, setMensaje] = useState("");
  const listado = usePaginaRemota("/api/v1/vehiculos/", vehiculoSchema, {
    empresa_id: empresa,
  });
  return (
    <>
      <Cabecera
        titulo="Vehículos"
        texto="Directorio de la flota y registro de motocicletas para los motoristas."
        recargar={listado.recargar}
        cargando={listado.cargando}
        accion={
          empresa && perfil?.permisos.includes("vehiculo.administrar") ? (
            <button
              className="boton primario"
              onClick={() => setNuevo((v) => !v)}
            >
              Registrar motocicleta
            </button>
          ) : undefined
        }
      />
      <EmpresaCampo
        valor={empresa}
        cambiar={(id) => {
          setParams({ empresa_id: id });
          setNuevo(false);
          setMensaje("");
        }}
      />
      {mensaje && <Exito>{mensaje}</Exito>}
      {nuevo &&
        empresa &&
        perfil?.permisos.includes("vehiculo.administrar") && (
          <NuevoVehiculo
            permitirInactivo
            key={empresa}
            empresa={empresa}
            cerrar={() => setNuevo(false)}
            creado={() => {
              setNuevo(false);
              setMensaje("Motocicleta registrada.");
              listado.recargar();
            }}
          />
        )}
      <Panel titulo="Flota registrada">
        <TablaRemota consulta={listado} tituloVacio="Sin vehículos registrados">
          {(items) => (
            <div
              className="tabla-scroll"
              role="region"
              aria-label="Vehículos"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th>Placa</th>
                    <th>Vehículo</th>
                    <th>Año</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <strong>{v.placa}</strong>
                      </td>
                      <td>
                        {[v.marca, v.modelo].filter(Boolean).join(" ") ||
                          "Sin marca o modelo"}
                      </td>
                      <td>{v.anio ?? "Sin año"}</td>
                      <td>
                        {v.tipo === "MOTOCICLETA" ? "Motocicleta" : v.tipo}
                      </td>
                      <td>
                        <Etiqueta tono={v.estado === "ACTIVO" ? "verde" : ""}>
                          {(
                            {
                              ACTIVO: "Activo",
                              MANTENIMIENTO: "Mantenimiento",
                              FUERA_SERVICIO: "Fuera de servicio",
                              INACTIVO: "Inactivo",
                            } as Record<string, string>
                          )[v.estado] ?? v.estado}
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
    </>
  );
}
