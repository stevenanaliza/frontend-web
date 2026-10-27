import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./auth";
import { api, ApiError, consulta, parsear } from "./api";
import { rolesAsignablesSchema, usuarioSchema } from "./contratos-admin";
import { Cabecera, Campo } from "./admin-comunes";
import {
  Cargando,
  ErrorCampo,
  ErrorVista,
  Panel,
  Vacio,
  useConsulta,
} from "./componentes";
import {
  AlcanceCampos,
  Formulario,
  Password,
  payloadAlcance,
  useAlcance,
  useOperacion,
  type Alcance,
} from "./formularios";

function validarContexto(alcance: Alcance, rol: string) {
  const errores: Record<string, string[]> = {};
  if (alcance.tipo_alcance !== "GLOBAL" && !alcance.empresa_id)
    errores.empresa_id = ["Selecciona una empresa."];
  if (alcance.tipo_alcance === "SUCURSAL" && !alcance.sucursal_id)
    errores.sucursal_id = ["Selecciona una sucursal."];
  if (!rol) errores.rol_codigo = ["Selecciona un rol autorizado."];
  if (Object.keys(errores).length) throw new ApiError(400, errores);
}
function RolesAsignables({
  alcance,
  valor,
  cambiar,
  error,
}: {
  alcance: Alcance;
  valor: string;
  cambiar: (rol: string) => void;
  error: unknown;
}) {
  const listo =
    alcance.tipo_alcance === "GLOBAL" ||
    Boolean(
      alcance.empresa_id &&
      (alcance.tipo_alcance !== "SUCURSAL" || alcance.sucursal_id),
    );
  return listo ? (
    <CatalogoRoles
      key={JSON.stringify(alcance)}
      alcance={alcance}
      valor={valor}
      cambiar={cambiar}
      error={error}
    />
  ) : (
    <p className="ayuda-form">
      Completa el alcance para consultar los roles que puedes conceder.
    </p>
  );
}
function CatalogoRoles({
  alcance,
  valor,
  cambiar,
  error,
}: {
  alcance: Alcance;
  valor: string;
  cambiar: (rol: string) => void;
  error: unknown;
}) {
  const filtros = payloadAlcance(alcance);
  const ruta = `/api/v1/usuarios/roles-asignables/${consulta({ tipo_alcance: filtros.tipo_alcance, empresa_id: filtros.empresa_id ?? "", sucursal_id: filtros.sucursal_id ?? "" })}`;
  const catalogo = useConsulta(
    async (signal) =>
      parsear(rolesAsignablesSchema, await api.solicitar(ruta, { signal })),
    ruta,
  );
  return catalogo.cargando ? (
    <Cargando texto="Consultando roles delegables…" />
  ) : catalogo.error ? (
    <ErrorVista error={catalogo.error} reintentar={catalogo.recargar} />
  ) : catalogo.datos && catalogo.datos.resultados.length ? (
    <label className="campo-form" htmlFor="rol_codigo">
      Rol autorizado
      <select
        id="rol_codigo"
        value={valor}
        onChange={(event) => cambiar(event.target.value)}
        required
        aria-describedby="rol_codigo-error"
      >
        <option value="">Selecciona un rol</option>
        {catalogo.datos.resultados.map((rol) => (
          <option key={rol.codigo} value={rol.codigo}>
            {rol.nombre}
          </option>
        ))}
      </select>
      <ErrorCampo campo="rol_codigo" error={error} />
    </label>
  ) : (
    <Vacio
      titulo="Sin roles delegables"
      texto="El servidor no autoriza conceder roles en este alcance."
    />
  );
}
export function NuevoUsuario() {
  const { perfil } = useAuth();
  const navegar = useNavigate();
  const operacion = useOperacion();
  const [alcance, setAlcance] = useAlcance();
  const [rol, setRol] = useState("");
  if (
    !perfil?.permisos.includes("usuario.administrar") ||
    !perfil.permisos.includes("rol.asignar")
  )
    return (
      <Panel titulo="Permisos insuficientes">
        <Vacio
          titulo="No puedes crear usuarios"
          texto="Se requieren administración de usuarios y asignación de roles."
        />
      </Panel>
    );
  return (
    <>
      <Link to="/usuarios" className="enlace-volver">
        Volver a usuarios
      </Link>
      <Cabecera
        titulo="Crear usuario"
        texto="Crea la cuenta y su primer rol en una sola operación."
      />
      <Formulario
        titulo="Datos de la nueva cuenta"
        operacion={operacion}
        textoGuardar="Crear usuario"
        cancelar={() => navegar("/usuarios")}
        enviar={async (datos) => {
          validarContexto(alcance, rol);
          if (datos.get("contrasena_temporal") !== datos.get("confirmacion"))
            throw new ApiError(400, {
              confirmacion: ["Las contraseñas no coinciden."],
            });
          const nuevo = parsear(
            usuarioSchema,
            await api.solicitar("/api/v1/usuarios/", {
              method: "POST",
              body: JSON.stringify({
                correo: String(datos.get("correo")).trim(),
                nombres: String(datos.get("nombres")).trim(),
                apellidos: String(datos.get("apellidos")).trim(),
                telefono: String(datos.get("telefono")).trim() || null,
                contrasena_temporal: String(datos.get("contrasena_temporal")),
                rol_codigo: rol,
                ...payloadAlcance(alcance),
              }),
            }),
          );
          navegar(`/usuarios/${nuevo.id}`, {
            state: { mensaje: "Usuario creado con su primer rol." },
            replace: true,
          });
        }}
      >
        <div className="form-grid">
          <Campo
            nombre="correo"
            etiqueta="Correo electrónico"
            type="email"
            maxLength={254}
            required
            error={operacion.error}
          />
          <Campo
            nombre="nombres"
            etiqueta="Nombres"
            maxLength={150}
            required
            error={operacion.error}
          />
          <Campo
            nombre="apellidos"
            etiqueta="Apellidos"
            maxLength={150}
            required
            error={operacion.error}
          />
          <Campo
            nombre="telefono"
            etiqueta="Teléfono"
            type="tel"
            maxLength={32}
            error={operacion.error}
          />
          <Password error={operacion.error} />
          <Password
            nombre="confirmacion"
            etiqueta="Confirmar contraseña temporal"
            error={operacion.error}
          />
        </div>
        <div className="subform">
          <h3>Primer rol y alcance</h3>
          <AlcanceCampos
            valor={alcance}
            cambiar={(valor) => {
              setAlcance(valor);
              setRol("");
            }}
            error={operacion.error}
          />
          <RolesAsignables
            alcance={alcance}
            valor={rol}
            cambiar={setRol}
            error={operacion.error}
          />
        </div>
      </Formulario>
    </>
  );
}
export function AsignarRol({
  usuarioId,
  empresaId,
  sucursalId,
  cerrar,
  guardado,
}: {
  usuarioId: string;
  empresaId: string | null;
  sucursalId: string | null;
  cerrar: () => void;
  guardado: () => void;
}) {
  const [alcance, setAlcance] = useAlcance({
    tipo_alcance: sucursalId ? "SUCURSAL" : empresaId ? "EMPRESA" : "GLOBAL",
    empresa_id: empresaId ?? "",
    sucursal_id: sucursalId ?? "",
  });
  const [rol, setRol] = useState("");
  const operacion = useOperacion();
  return (
    <Formulario
      titulo="Asignar rol"
      operacion={operacion}
      cancelar={cerrar}
      textoGuardar="Asignar rol"
      enviar={async () => {
        validarContexto(alcance, rol);
        await api.solicitar(
          `/api/v1/usuarios/${encodeURIComponent(usuarioId)}/roles/`,
          {
            method: "POST",
            body: JSON.stringify({
              rol_codigo: rol,
              ...payloadAlcance(alcance),
            }),
          },
        );
        guardado();
      }}
    >
      <AlcanceCampos
        valor={alcance}
        cambiar={(v) => {
          setAlcance(v);
          setRol("");
        }}
        error={operacion.error}
      />
      <RolesAsignables
        alcance={alcance}
        valor={rol}
        cambiar={setRol}
        error={operacion.error}
      />
    </Formulario>
  );
}
export function RestablecerContrasena({
  usuarioId,
  nombre,
  cerrar,
  guardado,
}: {
  usuarioId: string;
  nombre: string;
  cerrar: () => void;
  guardado: () => void;
}) {
  const { perfil } = useAuth();
  const operacion = useOperacion();
  return (
    <Formulario
      titulo={
        perfil?.usuario.id === usuarioId
          ? "Cambiar mi contraseña"
          : `Restablecer contraseña de ${nombre}`
      }
      operacion={operacion}
      cancelar={cerrar}
      textoGuardar="Confirmar nueva contraseña"
      aviso={
        <p className="aviso">
          La nueva contraseña se aplicará mediante el restablecimiento
          administrativo y cerrará todas las sesiones de esta cuenta. La
          política de contraseña la valida el servidor.
        </p>
      }
      enviar={async (datos) => {
        if (datos.get("contrasena_temporal") !== datos.get("confirmacion"))
          throw new ApiError(400, {
            confirmacion: ["Las contraseñas no coinciden."],
          });
        await api.solicitar(
          `/api/v1/usuarios/${encodeURIComponent(usuarioId)}/restablecer-contrasena/`,
          {
            method: "POST",
            body: JSON.stringify({
              contrasena_temporal: String(datos.get("contrasena_temporal")),
            }),
          },
        );
        if (perfil?.usuario.id === usuarioId) {
          await api.limpiar();
        } else guardado();
      }}
    >
      <div className="form-grid">
        <Password etiqueta="Nueva contraseña" error={operacion.error} />
        <Password
          nombre="confirmacion"
          etiqueta="Confirmar nueva contraseña"
          error={operacion.error}
        />
      </div>
    </Formulario>
  );
}
export function MiCuenta() {
  const { perfil } = useAuth();
  const [cambiar, setCambiar] = useState(false);
  const operacion = useOperacion();
  if (!perfil) return null;
  return (
    <>
      <Cabecera
        titulo="Mi cuenta"
        texto="Perfil, contraseña y seguridad de tus sesiones."
      />
      <Panel titulo="Información de acceso">
        <dl className="datos-detalle">
          <div>
            <dt>Nombre</dt>
            <dd>
              {perfil.usuario.nombres} {perfil.usuario.apellidos}
            </dd>
          </div>
          <div>
            <dt>Correo electrónico</dt>
            <dd>{perfil.usuario.correo}</dd>
          </div>
          <div>
            <dt>Empresa</dt>
            <dd>{perfil.empresa?.nombre ?? "Alcance según tus roles"}</dd>
          </div>
          <div>
            <dt>Roles vigentes</dt>
            <dd>
              {perfil.roles.map((r) => r.nombre).join(", ") ||
                "Sin roles asignados"}
            </dd>
          </div>
        </dl>
      </Panel>
      {perfil.permisos.includes("usuario.administrar") ? (
        cambiar ? (
          <RestablecerContrasena
            usuarioId={perfil.usuario.id}
            nombre={perfil.usuario.nombres}
            cerrar={() => setCambiar(false)}
            guardado={() => setCambiar(false)}
          />
        ) : (
          <button
            className="boton primario separacion-panel"
            onClick={() => setCambiar(true)}
          >
            Cambiar mi contraseña
          </button>
        )
      ) : (
        <p className="aviso separacion-panel">
          El contrato actual solo permite restablecimientos administrativos.
          Solicita el cambio a una persona con permiso para administrar tu
          cuenta.
        </p>
      )}
      <Formulario
        titulo="Cerrar todas mis sesiones"
        operacion={operacion}
        textoGuardar="Cerrar todas las sesiones"
        aviso={
          <p className="ayuda-form">
            Cierra esta sesión y las demás sesiones abiertas de tu cuenta.
          </p>
        }
        enviar={async () => {
          await api.solicitar(
            "/api/v1/autenticacion/cerrar-todas-las-sesiones/",
            { method: "POST" },
          );
          await api.limpiar();
        }}
      >
        <label className="confirmacion">
          <input type="checkbox" required />
          Confirmo que quiero cerrar todas mis sesiones.
        </label>
      </Formulario>
    </>
  );
}
