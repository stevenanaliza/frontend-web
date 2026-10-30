import { cantidad } from "./carga";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "./auth";
import { Cabecera, Campo, TablaRemota, usePaginaRemota } from "./admin-comunes";
import {
  empresaDetalleSchema,
  catalogoSchema,
  ubicacionGestionSchema,
  type UbicacionGestion,
} from "./contratos-gestion";
import { api, ApiError, parsear } from "./api";
import {
  Cargando,
  ErrorCampo,
  ErrorVista,
  Etiqueta,
  Panel,
  useConsulta,
} from "./componentes";
import { EmpresaCampo, Exito, Formulario, useOperacion } from "./formularios";

export function Empresas() {
  const { perfil } = useAuth();
  const listado = usePaginaRemota(
    "/api/v1/organizaciones/empresas/",
    empresaDetalleSchema,
  );
  return (
    <>
      <Cabecera
        titulo="Empresas"
        texto="Organizaciones autorizadas, sus datos de contacto y accesos a su administración."
        recargar={listado.recargar}
        cargando={listado.cargando}
      />
      <p className="aviso">
        El alta y la edición de los datos de empresa requieren la administración
        del servicio. Los límites de motoristas se configuran por separado según
        tus permisos.
      </p>
      <Panel titulo="Empresas de tu alcance">
        <TablaRemota consulta={listado} tituloVacio="Sin empresas visibles">
          {(items) => (
            <div
              className="tabla-scroll"
              role="region"
              aria-label="Empresas"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>País</th>
                    <th>Contacto</th>
                    <th>Estado</th>
                    <th>Límites por motorista</th>
                    <th>Administración</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <strong>{e.nombre}</strong>
                        <small>
                          {e.razon_social ?? "Sin razón social registrada"}
                        </small>
                        <small>
                          {e.identificacion_fiscal ??
                            "Sin identificación fiscal"}
                        </small>
                      </td>
                      <td>{e.pais.nombre}</td>
                      <td>
                        {e.telefono ?? "Sin teléfono"}
                        <small>{e.correo ?? "Sin correo"}</small>
                      </td>
                      <td>
                        <Etiqueta tono={e.estado === "ACTIVO" ? "verde" : ""}>
                          {e.estado === "ACTIVO" ? "Activa" : e.estado}
                        </Etiqueta>
                      </td>
                      <td>
                        {e.limites_motoristas ? (
                          <>
                            <strong>
                              {e.limites_motoristas.limite_tubos} tubos
                            </strong>
                            <small>
                              {cantidad(e.limites_motoristas.limite_frascos)}{" "}
                              frascos
                            </small>
                            <small>
                              {e.limites_motoristas.limite_solicitudes}{" "}
                              solicitudes activas
                            </small>
                            <small>
                              {e.limites_motoristas.alcance === "RED"
                                ? "Configuración general de red"
                                : "Configuración de empresa"}
                            </small>
                          </>
                        ) : (
                          "Sin configuración informada"
                        )}
                      </td>
                      <td>
                        <div className="acciones">
                          <Link
                            className="boton secundario"
                            to={`/limites-motoristas?empresa_id=${encodeURIComponent(e.id)}`}
                          >
                            Límites de motoristas
                          </Link>
                          {[
                            ["sucursal.ver", "sucursales", "Sucursales"],
                            ["ubicacion.ver", "ubicaciones", "Ubicaciones"],
                            ["vehiculo.ver", "vehiculos", "Vehículos"],
                          ].map(
                            ([permiso, ruta, nombre]) =>
                              perfil?.permisos.includes(permiso) && (
                                <Link
                                  className="boton secundario"
                                  key={ruta}
                                  to={`/${ruta}?empresa_id=${encodeURIComponent(e.id)}`}
                                >
                                  {nombre}
                                </Link>
                              ),
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

export function Ubicaciones() {
  const { perfil } = useAuth();
  const [params, setParams] = useSearchParams();
  const empresa = params.get("empresa_id") ?? perfil?.empresa?.id ?? "";
  const [nueva, setNueva] = useState(params.get("crear") === "1");
  return (
    <>
      <Cabecera
        titulo="Ubicaciones"
        texto="Registra direcciones y autoriza su uso como origen o destino para cada empresa."
        accion={
          empresa && perfil?.permisos.includes("ubicacion.crear") ? (
            <button
              className="boton primario"
              onClick={() => setNueva((v) => !v)}
            >
              Crear ubicación
            </button>
          ) : undefined
        }
      />
      <EmpresaCampo
        valor={empresa}
        cambiar={(id) => {
          setParams({ empresa_id: id });
          setNueva(false);
        }}
      />
      {empresa && (
        <GestionUbicaciones
          key={empresa}
          empresa={empresa}
          nueva={nueva && Boolean(perfil?.permisos.includes("ubicacion.crear"))}
          cerrar={() => setNueva(false)}
        />
      )}
    </>
  );
}
function GestionUbicaciones({
  empresa,
  nueva,
  cerrar,
}: {
  empresa: string;
  nueva: boolean;
  cerrar: () => void;
}) {
  const { perfil } = useAuth();
  const [seleccion, setSeleccion] = useState<UbicacionGestion | null>(null);
  const [mensaje, setMensaje] = useState("");
  const listado = usePaginaRemota(
    "/api/v1/ubicaciones/",
    ubicacionGestionSchema,
    { empresa_id: empresa },
  );
  function guardada(texto: string) {
    cerrar();
    setSeleccion(null);
    setMensaje(texto);
    listado.recargar();
  }
  return (
    <>
      {mensaje && <Exito>{mensaje}</Exito>}
      {nueva && (
        <NuevaUbicacion
          empresa={empresa}
          cerrar={cerrar}
          guardada={() =>
            guardada(
              "Ubicación registrada. Su estado de autorización figura en el directorio.",
            )
          }
        />
      )}
      {seleccion && (
        <AutorizarUbicacion
          key={seleccion.id}
          ubicacion={seleccion}
          cerrar={() => setSeleccion(null)}
          guardada={() => guardada("Autorización de ubicación actualizada.")}
        />
      )}
      <Panel
        titulo="Directorio de ubicaciones"
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
          tituloVacio="Sin ubicaciones registradas en esta empresa"
        >
          {(items) => (
            <div
              className="tabla-scroll"
              role="region"
              aria-label="Ubicaciones"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th>Ubicación</th>
                    <th>Dirección</th>
                    <th>Uso autorizado</th>
                    <th>Estado</th>
                    <th>Gestión</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.ubicacion.nombre}</strong>
                        <small>{u.ubicacion.tipo_ubicacion.nombre}</small>
                      </td>
                      <td className="celda-texto">
                        {u.ubicacion.direccion}
                        <small>
                          {[
                            u.ubicacion.ciudad,
                            u.ubicacion.departamento,
                            u.ubicacion.pais.nombre,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </small>
                        <small>
                          {u.ubicacion.nombre_contacto ?? "Sin contacto"} ·{" "}
                          {u.ubicacion.telefono ?? "Sin teléfono"}
                        </small>
                      </td>
                      <td>
                        {[
                          u.permite_origen && "Origen",
                          u.permite_destino && "Destino",
                        ]
                          .filter(Boolean)
                          .join(" y ") || "Sin uso habilitado"}
                      </td>
                      <td>
                        <Etiqueta tono={u.estado === "APROBADO" ? "verde" : ""}>
                          {(
                            {
                              APROBADO: "Aprobada",
                              PENDIENTE: "Pendiente",
                              RECHAZADO: "Rechazada",
                              INACTIVO: "Inactiva",
                            } as Record<string, string>
                          )[u.estado] ?? u.estado}
                        </Etiqueta>
                        <small>
                          {u.ubicacion.estado === "ACTIVO"
                            ? "Ubicación activa"
                            : "Ubicación inactiva"}
                        </small>
                      </td>
                      <td>
                        {perfil?.permisos.includes("ubicacion.aprobar") ? (
                          <button
                            className="boton secundario"
                            onClick={() => {
                              setSeleccion(u);
                              cerrar();
                            }}
                          >
                            Gestionar autorización
                          </button>
                        ) : (
                          "Solo consulta"
                        )}
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
function UsosUbicacion({
  error,
  origen = true,
  destino = true,
}: {
  error: unknown;
  origen?: boolean;
  destino?: boolean;
}) {
  return (
    <div className="form-grid">
      <label className="confirmacion">
        <input type="checkbox" name="permite_origen" defaultChecked={origen} />
        Permitir como origen
        <ErrorCampo campo="permite_origen" error={error} />
      </label>
      <label className="confirmacion">
        <input
          type="checkbox"
          name="permite_destino"
          defaultChecked={destino}
        />
        Permitir como destino
        <ErrorCampo campo="permite_destino" error={error} />
      </label>
    </div>
  );
}
function NuevaUbicacion({
  empresa,
  cerrar,
  guardada,
}: {
  empresa: string;
  cerrar: () => void;
  guardada: () => void;
}) {
  const { perfil } = useAuth();
  const operacion = useOperacion();
  const tipos = useConsulta(
    async (signal) =>
      parsear(
        catalogoSchema,
        await api.solicitar("/api/v1/ubicaciones/tipos/", { signal }),
      ),
    "tipos-ubicacion",
  );
  const paisEmpresa = useConsulta(
    async (signal) =>
      perfil?.permisos.includes("empresa.ver")
        ? parsear(
            empresaDetalleSchema,
            await api.solicitar(
              `/api/v1/organizaciones/empresas/${encodeURIComponent(empresa)}/`,
              { signal },
            ),
          )
        : null,
    empresa,
  );
  return (
    <Formulario
      titulo="Registrar ubicación"
      operacion={operacion}
      cancelar={cerrar}
      textoGuardar="Registrar ubicación"
      aviso={
        <p className="ayuda-form">
          Introduce la dirección y sus coordenadas. El departamento permite
          encontrar destinos compatibles. La aprobación depende de tus permisos.
        </p>
      }
      enviar={async (datos) => {
        const pais =
          paisEmpresa.datos?.pais.id ?? String(datos.get("pais_id") ?? "");
        if (!pais)
          throw new ApiError(400, {
            pais_id: ["Indica el país de la ubicación."],
          });
        if (
          !tipos.datos?.resultados.some(
            (t) => t.id === datos.get("tipo_ubicacion_id"),
          )
        )
          throw new ApiError(400, {
            tipo_ubicacion_id: ["Selecciona un tipo disponible."],
          });
        if (!datos.has("permite_origen") && !datos.has("permite_destino"))
          throw new ApiError(400, {
            permite_origen: ["Habilita al menos origen o destino."],
          });
        parsear(
          ubicacionGestionSchema,
          await api.solicitar("/api/v1/ubicaciones/", {
            method: "POST",
            body: JSON.stringify({
              empresa_id: empresa,
              pais_id: pais,
              tipo_ubicacion_id: datos.get("tipo_ubicacion_id"),
              origen: "REGISTRADA_USUARIO",
              ...Object.fromEntries(
                [
                  "nombre",
                  "direccion",
                  "latitud",
                  "longitud",
                  "departamento",
                  "municipio",
                  "ciudad",
                  "colonia",
                  "telefono",
                  "nombre_contacto",
                  "instrucciones",
                ].map((c) => [c, String(datos.get(c) ?? "").trim() || null]),
              ),
              permite_origen: datos.has("permite_origen"),
              permite_destino: datos.has("permite_destino"),
            }),
          }),
        );
        guardada();
      }}
    >
      {tipos.cargando && <Cargando texto="Consultando tipos de ubicación…" />}
      {tipos.error != null && (
        <ErrorVista error={tipos.error} reintentar={tipos.recargar} />
      )}
      {paisEmpresa.cargando ? (
        <Cargando texto="Consultando país de la empresa…" />
      ) : paisEmpresa.datos ? (
        <p className="contexto-form">
          <strong>País:</strong> {paisEmpresa.datos.pais.nombre}
        </p>
      ) : (
        <>
          <Campo
            nombre="pais_id"
            etiqueta="ID del país autorizado"
            required
            error={operacion.error}
          />
          {paisEmpresa.error != null && (
            <ErrorVista
              error={paisEmpresa.error}
              reintentar={paisEmpresa.recargar}
            />
          )}
        </>
      )}
      <div className="form-grid">
        <Campo
          nombre="nombre"
          etiqueta="Nombre de ubicación"
          maxLength={200}
          required
          error={operacion.error}
        />
        <label className="campo-form" htmlFor="tipo_ubicacion_id">
          Tipo de ubicación
          <select
            id="tipo_ubicacion_id"
            name="tipo_ubicacion_id"
            defaultValue=""
            required
            aria-describedby="tipo_ubicacion_id-error"
          >
            <option value="">Selecciona un tipo</option>
            {tipos.datos?.resultados.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
          <ErrorCampo campo="tipo_ubicacion_id" error={operacion.error} />
        </label>
        <Campo
          nombre="direccion"
          etiqueta="Dirección"
          required
          error={operacion.error}
        />
        <Campo
          nombre="departamento"
          etiqueta="Departamento"
          maxLength={150}
          error={operacion.error}
        />
        <Campo
          nombre="municipio"
          etiqueta="Municipio"
          maxLength={150}
          error={operacion.error}
        />
        <Campo
          nombre="ciudad"
          etiqueta="Ciudad"
          maxLength={150}
          error={operacion.error}
        />
        <Campo
          nombre="colonia"
          etiqueta="Colonia"
          maxLength={150}
          error={operacion.error}
        />
        <Campo
          nombre="latitud"
          etiqueta="Latitud"
          type="number"
          step="0.000001"
          min={-90}
          max={90}
          required
          error={operacion.error}
        />
        <Campo
          nombre="longitud"
          etiqueta="Longitud"
          type="number"
          step="0.000001"
          min={-180}
          max={180}
          required
          error={operacion.error}
        />
        <Campo
          nombre="telefono"
          etiqueta="Teléfono de contacto"
          type="tel"
          maxLength={32}
          error={operacion.error}
        />
        <Campo
          nombre="nombre_contacto"
          etiqueta="Nombre de contacto"
          maxLength={200}
          error={operacion.error}
        />
        <Campo
          nombre="instrucciones"
          etiqueta="Instrucciones de acceso"
          error={operacion.error}
        />
      </div>
      <UsosUbicacion error={operacion.error} />
    </Formulario>
  );
}
function AutorizarUbicacion({
  ubicacion: u,
  cerrar,
  guardada,
}: {
  ubicacion: UbicacionGestion;
  cerrar: () => void;
  guardada: () => void;
}) {
  const operacion = useOperacion();
  return (
    <Formulario
      titulo={`Autorización de ${u.ubicacion.nombre}`}
      operacion={operacion}
      cancelar={cerrar}
      textoGuardar="Guardar autorización"
      aviso={
        <p className="ayuda-form">
          La autorización se aplica únicamente a esta empresa. Desactivar una
          ubicación puede impedir que se utilice en nuevos traslados.
        </p>
      }
      enviar={async (datos) => {
        if (
          datos.get("estado") === "APROBADO" &&
          !datos.has("permite_origen") &&
          !datos.has("permite_destino")
        )
          throw new ApiError(400, {
            permite_origen: [
              "Una ubicación aprobada debe permitir origen o destino.",
            ],
          });
        parsear(
          ubicacionGestionSchema,
          await api.solicitar(
            `/api/v1/ubicaciones/${encodeURIComponent(u.ubicacion.id)}/autorizacion-empresa/${encodeURIComponent(u.empresa_id)}/`,
            {
              method: "PATCH",
              body: JSON.stringify({
                estado: datos.get("estado"),
                permite_origen: datos.has("permite_origen"),
                permite_destino: datos.has("permite_destino"),
              }),
            },
          ),
        );
        guardada();
      }}
    >
      <label className="campo-form" htmlFor="estado">
        Estado de autorización
        <select
          id="estado"
          name="estado"
          defaultValue={u.estado}
          aria-describedby="estado-error"
        >
          <option value="APROBADO">Aprobada</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="RECHAZADO">Rechazada</option>
          <option value="INACTIVO">Inactiva</option>
        </select>
        <ErrorCampo campo="estado" error={operacion.error} />
      </label>
      <UsosUbicacion
        error={operacion.error}
        origen={u.permite_origen}
        destino={u.permite_destino}
      />
    </Formulario>
  );
}
