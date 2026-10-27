import { useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Check } from "lucide-react";
import { useAuth } from "./auth";
import { api, parsear } from "./api";
import { usuarioSchema, rolesHistorialSchema } from "./contratos-admin";
import {
  Cabecera,
  Campo,
  ErroresFormulario,
  Filtros,
  TablaRemota,
  usePaginaRemota,
} from "./admin-comunes";
import {
  Cargando,
  ErrorCampo,
  ErrorVista,
  Etiqueta,
  Panel,
  Vacio,
  fechaHora,
  useConsulta,
} from "./componentes";
import type { z } from "zod";
import { AsignarRol, RestablecerContrasena } from "./GestionUsuarios";
import { Formulario, useOperacion } from "./formularios";

export function Usuarios() {
  const { perfil } = useAuth();
  const listado = usePaginaRemota("/api/v1/usuarios/", usuarioSchema);
  return (
    <>
      <Cabecera
        titulo="Usuarios y roles"
        texto="Personas autorizadas y alcance de sus roles vigentes."
        recargar={listado.recargar}
        cargando={listado.cargando}
        accion={
          perfil?.permisos.includes("usuario.administrar") &&
          perfil.permisos.includes("rol.asignar") ? (
            <Link className="boton primario" to="/usuarios/nuevo">
              Crear usuario
            </Link>
          ) : undefined
        }
      />
      <Filtros />
      <Panel titulo="Usuarios en tu alcance">
        <TablaRemota consulta={listado} tituloVacio="Sin usuarios visibles">
          {(items) => (
            <div
              className="tabla-scroll"
              role="region"
              aria-label="Usuarios"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th>Persona</th>
                    <th>Correo</th>
                    <th>Estado</th>
                    <th>Roles vigentes</th>
                    <th>Consulta</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <strong>
                          {u.nombres} {u.apellidos}
                        </strong>
                        <small>{u.telefono ?? "Sin teléfono"}</small>
                      </td>
                      <td>{u.correo}</td>
                      <td>
                        <Etiqueta tono={u.estado === "ACTIVO" ? "verde" : ""}>
                          {u.estado === "ACTIVO"
                            ? "Activo"
                            : u.estado === "SUSPENDIDO"
                              ? "Suspendido"
                              : "Inactivo"}
                        </Etiqueta>
                      </td>
                      <td className="celda-texto">
                        {u.roles.length
                          ? u.roles.map((r) => (
                              <span
                                key={`${r.codigo}:${r.empresa_id}:${r.sucursal_id}`}
                                className="rol-linea"
                              >
                                {r.nombre}
                                <small>
                                  Alcance:{" "}
                                  {r.tipo_alcance.toLocaleLowerCase("es")}
                                </small>
                              </span>
                            ))
                          : "Sin roles vigentes"}
                      </td>
                      <td>
                        <Link
                          className="boton secundario"
                          to={`/usuarios/${u.id}`}
                        >
                          Ver usuario
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
    </>
  );
}
function EdicionUsuario({
  usuario,
  cerrar,
  guardado,
}: {
  usuario: z.infer<typeof usuarioSchema>;
  cerrar: () => void;
  guardado: () => void;
}) {
  const { perfil } = useAuth();
  const [error, setError] = useState<unknown>(null);
  const [ocupado, setOcupado] = useState(false);
  const enviando = useRef(false);
  const [estado, setEstado] = useState(usuario.estado);
  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviando.current) return;
    enviando.current = true;
    setOcupado(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      parsear(
        usuarioSchema,
        await api.solicitar(
          `/api/v1/usuarios/${encodeURIComponent(usuario.id)}/`,
          {
            method: "PATCH",
            body: JSON.stringify({
              nombres: String(form.get("nombres")).trim(),
              apellidos: String(form.get("apellidos")).trim(),
              telefono: String(form.get("telefono")).trim() || null,
              estado,
            }),
          },
        ),
      );
      guardado();
    } catch (e) {
      setError(e);
    } finally {
      enviando.current = false;
      setOcupado(false);
    }
  }
  return (
    <Panel titulo="Editar usuario" className="formulario-edicion">
      <form onSubmit={guardar}>
        <ErroresFormulario error={error} />
        <div className="form-grid">
          <Campo
            nombre="nombres"
            etiqueta="Nombres"
            defaultValue={usuario.nombres}
            required
            error={error}
          />
          <Campo
            nombre="apellidos"
            etiqueta="Apellidos"
            defaultValue={usuario.apellidos}
            required
            error={error}
          />
          <Campo
            nombre="telefono"
            etiqueta="Teléfono"
            type="tel"
            defaultValue={usuario.telefono ?? ""}
            error={error}
          />
          <label className="campo-form" htmlFor="estado">
            Estado
            <select
              name="estado"
              id="estado"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              aria-describedby="estado-error"
            >
              <option value="ACTIVO">Activo</option>
              <option
                value="INACTIVO"
                disabled={perfil?.usuario.id === usuario.id}
              >
                Inactivo
              </option>
              <option
                value="SUSPENDIDO"
                disabled={perfil?.usuario.id === usuario.id}
              >
                Suspendido
              </option>
            </select>
            <ErrorCampo campo="estado" error={error} />
          </label>
        </div>
        {estado !== "ACTIVO" && estado !== usuario.estado && (
          <p className="aviso">
            Este cambio revocará las sesiones del usuario. Si es motorista, el
            backend aplicará sus reglas de recuperación y reasignación de
            servicios.
          </p>
        )}
        <div className="acciones-form">
          <button
            type="button"
            className="boton secundario"
            disabled={ocupado}
            onClick={cerrar}
          >
            Cancelar
          </button>
          <button className="boton primario" disabled={ocupado}>
            {ocupado ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </form>
    </Panel>
  );
}
function HistorialRoles({
  id,
  actualizado,
}: {
  id: string;
  actualizado: () => void;
}) {
  const { perfil } = useAuth();
  const [revocar, setRevocar] = useState<{ id: string; nombre: string } | null>(
    null,
  );
  const operacion = useOperacion();
  const administra = Boolean(
    perfil?.permisos.includes("usuario.administrar") &&
    perfil.permisos.includes("rol.asignar"),
  );
  const ruta = `/api/v1/usuarios/${encodeURIComponent(id)}/roles/`;
  const roles = useConsulta(
    async (signal) =>
      parsear(rolesHistorialSchema, await api.solicitar(ruta, { signal })),
    ruta,
  );
  return (
    <Panel titulo="Historial de roles" className="separacion-panel">
      {roles.cargando ? (
        <Cargando />
      ) : roles.error ? (
        <ErrorVista error={roles.error} reintentar={roles.recargar} />
      ) : (
        roles.datos && (
          <>
            {roles.datos.resultados.length ? (
              <div className="tabla-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Rol</th>
                      <th>Alcance</th>
                      <th>Estado</th>
                      <th>Asignación (UTC)</th>
                      <th>Revocación (UTC)</th>
                      {administra && <th>Acción</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {roles.datos.resultados.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <strong>{r.rol.nombre}</strong>
                          <small className="celda-texto">
                            {r.rol.descripcion}
                          </small>
                        </td>
                        <td>
                          {r.tipo_alcance === "GLOBAL"
                            ? "Global"
                            : r.tipo_alcance === "EMPRESA"
                              ? "Empresa"
                              : "Sucursal"}
                        </td>
                        <td>
                          <Etiqueta tono={r.activo ? "verde" : ""}>
                            {r.activo ? "Vigente" : "Revocado"}
                          </Etiqueta>
                        </td>
                        <td>{fechaHora(r.asignado_en, "UTC")}</td>
                        <td>
                          {r.revocado_en
                            ? fechaHora(r.revocado_en, "UTC")
                            : "Sin revocación"}
                        </td>
                        {administra && (
                          <td>
                            {r.activo && (
                              <button
                                className="boton secundario"
                                onClick={() =>
                                  setRevocar({ id: r.id, nombre: r.rol.nombre })
                                }
                              >
                                Revocar {r.rol.nombre}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Vacio
                titulo="Sin asignaciones de rol"
                texto="No hay asignaciones visibles para esta cuenta."
              />
            )}
          </>
        )
      )}
      {revocar && (
        <Formulario
          titulo={`Revocar rol: ${revocar.nombre}`}
          operacion={operacion}
          cancelar={() => setRevocar(null)}
          textoGuardar="Confirmar revocación"
          aviso={
            <p className="aviso">
              La revocación conserva el historial y cierra las sesiones del
              usuario. El servidor protege los últimos administradores y valida
              la delegación.
            </p>
          }
          enviar={async () => {
            await api.solicitar(
              `/api/v1/usuarios/${encodeURIComponent(id)}/roles/${encodeURIComponent(revocar.id)}/`,
              { method: "DELETE" },
            );
            setRevocar(null);
            if (perfil?.usuario.id === id) await api.limpiar();
            else {
              roles.recargar();
              actualizado();
            }
          }}
        >
          <label className="confirmacion">
            <input type="checkbox" required />
            Confirmo la revocación de este rol.
          </label>
        </Formulario>
      )}
    </Panel>
  );
}
export function DetalleUsuario() {
  const { id = "" } = useParams();
  const { perfil } = useAuth();
  const ubicacion = useLocation();
  const [editando, setEditando] = useState(false);
  const [mensaje, setMensaje] = useState(
    typeof ubicacion.state?.mensaje === "string" ? ubicacion.state.mensaje : "",
  );
  const [nuevoRol, setNuevoRol] = useState(false),
    [password, setPassword] = useState(false);
  const ruta = `/api/v1/usuarios/${encodeURIComponent(id)}/`;
  const usuario = useConsulta(
    async (signal) =>
      parsear(usuarioSchema, await api.solicitar(ruta, { signal })),
    ruta,
  );
  return (
    <>
      <Link to="/usuarios" className="enlace-volver">
        <ArrowLeft size={17} aria-hidden="true" />
        Volver a usuarios
      </Link>
      <Cabecera
        titulo={
          usuario.datos
            ? `${usuario.datos.nombres} ${usuario.datos.apellidos}`
            : "Detalle del usuario"
        }
        texto="Perfil administrativo e historial de autorizaciones."
        recargar={usuario.recargar}
        cargando={usuario.cargando}
        accion={
          usuario.datos &&
          perfil?.permisos.includes("usuario.administrar") &&
          !editando ? (
            <button
              className="boton primario"
              onClick={() => {
                setEditando(true);
                setMensaje("");
                requestAnimationFrame(() =>
                  document.getElementById("nombres")?.focus(),
                );
              }}
            >
              <Pencil size={16} aria-hidden="true" />
              Editar usuario
            </button>
          ) : undefined
        }
      />
      {mensaje && (
        <div className="exito" role="status">
          <Check size={17} aria-hidden="true" />
          {mensaje}
        </div>
      )}
      {usuario.cargando ? (
        <Cargando />
      ) : usuario.error ? (
        <ErrorVista error={usuario.error} reintentar={usuario.recargar} />
      ) : (
        usuario.datos && (
          <>
            {editando ? (
              <EdicionUsuario
                usuario={usuario.datos}
                cerrar={() => setEditando(false)}
                guardado={() => {
                  setEditando(false);
                  setMensaje("Cambios del usuario guardados.");
                  usuario.recargar();
                }}
              />
            ) : (
              <Panel titulo="Datos del usuario">
                <dl className="datos-detalle">
                  <div>
                    <dt>Correo electrónico</dt>
                    <dd>{usuario.datos.correo}</dd>
                  </div>
                  <div>
                    <dt>Teléfono</dt>
                    <dd>{usuario.datos.telefono || "Sin teléfono"}</dd>
                  </div>
                  <div>
                    <dt>Estado</dt>
                    <dd>
                      {usuario.datos.estado === "ACTIVO"
                        ? "Activo"
                        : usuario.datos.estado === "SUSPENDIDO"
                          ? "Suspendido"
                          : "Inactivo"}
                    </dd>
                  </div>
                  <div>
                    <dt>Fecha de alta (UTC)</dt>
                    <dd>{fechaHora(usuario.datos.creado_en, "UTC")}</dd>
                  </div>
                </dl>
              </Panel>
            )}
            {perfil?.permisos.includes("usuario.administrar") && (
              <div className="acciones separacion-panel">
                <button
                  className="boton secundario"
                  onClick={() => setPassword(!password)}
                >
                  Restablecer contraseña
                </button>
                {perfil.permisos.includes("rol.asignar") && (
                  <button
                    className="boton secundario"
                    onClick={() => setNuevoRol(!nuevoRol)}
                  >
                    Asignar rol
                  </button>
                )}
              </div>
            )}
            {password && (
              <RestablecerContrasena
                usuarioId={id}
                nombre={`${usuario.datos.nombres} ${usuario.datos.apellidos}`}
                cerrar={() => setPassword(false)}
                guardado={() => {
                  setPassword(false);
                  setMensaje(
                    "Contraseña restablecida. Las sesiones anteriores fueron revocadas.",
                  );
                }}
              />
            )}
            {nuevoRol && (
              <AsignarRol
                usuarioId={id}
                empresaId={usuario.datos.empresa_id}
                sucursalId={usuario.datos.sucursal_id}
                cerrar={() => setNuevoRol(false)}
                guardado={() => {
                  setNuevoRol(false);
                  setMensaje("Rol asignado.");
                  usuario.recargar();
                }}
              />
            )}
            <HistorialRoles
              id={id}
              actualizado={() => {
                setMensaje("Rol revocado.");
                usuario.recargar();
              }}
            />
          </>
        )
      )}
    </>
  );
}
