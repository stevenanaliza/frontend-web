import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "./auth";
import { api, ApiError, ContratoError, parsear } from "./api";
import { Cabecera, Campo } from "./admin-comunes";
import {
  Cargando,
  ErrorVista,
  Panel,
  Vacio,
  ErrorCampo,
  numero,
  useConsulta,
  invalidarConsultasMotoristas,
} from "./componentes";
import { EmpresaCampo, Exito, Formulario, useOperacion } from "./formularios";
import {
  limitesMotoristasSchema,
  puedeConfigurarLimites,
  type LimitesMotoristas as Limites,
} from "./limites-motoristas";

const rutaRed = "/api/v1/organizaciones/configuracion/limites-motoristas/";
export function LimitesMotoristas() {
  const { perfil } = useAuth();
  const [params, setParams] = useSearchParams();
  const empresa = params.get("empresa_id") ?? perfil?.empresa?.id ?? "";
  const red = params.get("alcance") === "RED";
  if (!perfil) return null;
  const global =
    perfil.permisos.includes("configuracion.administrar") &&
    perfil.roles.some((r) => r.tipo_alcance === "GLOBAL");
  if (!perfil.permisos.includes("empresa.ver") && !global)
    return (
      <Panel titulo="Permisos insuficientes">
        <Vacio
          titulo="No tienes acceso a este módulo"
          texto="Necesitas consultar empresas o administrar la configuración global."
        />
      </Panel>
    );
  return (
    <>
      <Cabecera
        titulo="Límites de motoristas"
        texto="Configura los cupos que se aplican individualmente a cada motorista de la empresa o de la red."
      />
      {!red && perfil.permisos.includes("empresa.ver") && (
        <EmpresaCampo
          valor={empresa}
          cambiar={(id) => setParams({ empresa_id: id })}
        />
      )}
      {!red && !empresa && global && (
        <Link className="boton secundario" to="/limites-motoristas?alcance=RED">
          Consultar configuración general de Network
        </Link>
      )}
      {red || empresa ? (
        <ConsultaLimites
          key={red ? "RED" : empresa}
          ruta={
            red
              ? rutaRed
              : `/api/v1/organizaciones/empresas/${encodeURIComponent(empresa)}/limites-motoristas/`
          }
          empresa={red ? undefined : empresa}
        />
      ) : (
        <p className="ayuda-form">
          Selecciona una empresa para consultar su configuración.
        </p>
      )}
    </>
  );
}
function ConsultaLimites({
  ruta,
  empresa,
}: {
  ruta: string;
  empresa?: string;
}) {
  const consulta = useConsulta(async (signal) => {
    const datos = parsear(
      limitesMotoristasSchema,
      await api.solicitar(ruta, { signal }),
    );
    if (datos.alcance === "EMPRESA" && datos.empresa_id !== empresa)
      throw new ContratoError(["empresa_id"]);
    if (!empresa && datos.alcance !== "RED")
      throw new ContratoError(["alcance"]);
    return datos;
  }, ruta);
  if (consulta.cargando)
    return <Cargando texto="Consultando límites compartidos…" />;
  if (consulta.error)
    return consulta.error instanceof ApiError &&
      consulta.error.status === 404 ? (
      <Panel titulo="Configuración no disponible">
        <Vacio
          titulo="No se encontró la configuración de límites"
          texto="La empresa puede estar fuera de tu alcance o el servicio todavía no ofrece esta configuración. No se utilizará la edición individual anterior."
        />
      </Panel>
    ) : (
      <ErrorVista error={consulta.error} reintentar={consulta.recargar} />
    );
  if (!consulta.datos) return null;
  if (empresa && consulta.datos.alcance === "RED")
    return <ConsultaLimites ruta={rutaRed} />;
  return <ConfiguracionLimites datos={consulta.datos} ruta={ruta} />;
}
function ConfiguracionLimites({
  datos: iniciales,
  ruta,
}: {
  datos: Limites;
  ruta: string;
}) {
  const { perfil } = useAuth();
  const [datos, setDatos] = useState(iniciales);
  const [editar, setEditar] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const operacion = useOperacion();
  if (!perfil) return null;
  const permitido = puedeConfigurarLimites(perfil, datos);
  const red = datos.alcance === "RED";
  return (
    <>
      {mensaje && <Exito>{mensaje}</Exito>}
      <Panel
        titulo={
          red
            ? "Configuración general de la red"
            : "Configuración de la empresa"
        }
      >
        <div className="limites-contenido">
          <p className="contexto-form">
            Cada motorista dispone de su propio cupo.{" "}
            {red
              ? "Estos límites se aplican a todos los motoristas de Network y a la carga de todos sus clientes."
              : "Estos límites se aplican a todos los motoristas de esta empresa; las demás empresas conservan su configuración."}
          </p>
          <dl className="datos-detalle">
            <div>
              <dt>Tubos por motorista</dt>
              <dd>{numero(datos.limite_tubos)}</dd>
            </div>
            <div>
              <dt>Solicitudes activas por motorista</dt>
              <dd>{numero(datos.limite_solicitudes)}</dd>
            </div>
          </dl>
          <p className="ayuda-form">
            El cupo es individual. No es un fondo compartido entre motoristas.
            La disponibilidad depende de la carga y del estado operativo que
            calcula el servidor.
          </p>
          {permitido ? (
            !editar && (
              <button
                className="boton primario"
                onClick={() => {
                  setMensaje("");
                  operacion.setError(null);
                  setEditar(true);
                  requestAnimationFrame(() =>
                    document.getElementById("limite_tubos")?.focus(),
                  );
                }}
              >
                Editar límites compartidos
              </button>
            )
          ) : (
            <p className="aviso">
              {red
                ? "Solo la administración con permiso global de configuración puede cambiar los límites de la red."
                : "Para cambiar estos límites necesitas administrar la empresa completa o tener alcance global. El permiso sobre una sucursal o un motorista no es suficiente."}
            </p>
          )}
        </div>
      </Panel>
      {editar && permitido && (
        <Formulario
          titulo="Cambiar límites compartidos"
          operacion={operacion}
          cancelar={() => setEditar(false)}
          textoGuardar="Guardar límites"
          aviso={
            <p className="aviso">
              El cambio afecta a{" "}
              {red ? "toda la red" : "toda la flota de esta empresa"}. El
              servidor comprueba la carga comprometida antes de reducir cupos y
              registra la modificación.
            </p>
          }
          enviar={async (form) => {
            const actualizado = parsear(
              limitesMotoristasSchema,
              await api.solicitar(ruta, {
                method: "PATCH",
                body: JSON.stringify({
                  limite_tubos: Number(form.get("limite_tubos")),
                  limite_solicitudes: Number(form.get("limite_solicitudes")),
                  motivo: String(form.get("motivo")).trim(),
                }),
              }),
            );
            if (
              actualizado.alcance !== datos.alcance ||
              (actualizado.alcance === "EMPRESA" &&
                datos.alcance === "EMPRESA" &&
                actualizado.empresa_id !== datos.empresa_id)
            )
              throw new ContratoError(["alcance", "empresa_id"]);
            setEditar(false);
            setDatos(actualizado);
            setMensaje(
              `Límites actualizados: ${actualizado.limite_tubos} tubos y ${actualizado.limite_solicitudes} solicitudes activas por motorista.`,
            );
            invalidarConsultasMotoristas();
          }}
        >
          <div className="form-grid">
            <Campo
              nombre="limite_tubos"
              etiqueta="Límite de tubos por motorista"
              type="number"
              min={1}
              max={2147483647}
              step={1}
              defaultValue={datos.limite_tubos}
              required
              error={operacion.error}
            />
            <Campo
              nombre="limite_solicitudes"
              etiqueta="Límite de solicitudes por motorista"
              type="number"
              min={1}
              max={5}
              step={1}
              defaultValue={datos.limite_solicitudes}
              required
              error={operacion.error}
            />
            <label className="campo-form" htmlFor="motivo">
              Motivo del cambio (opcional)
              <textarea
                id="motivo"
                name="motivo"
                maxLength={1000}
                rows={3}
                aria-describedby="motivo-error"
              />
              <ErrorCampo campo="motivo" error={operacion.error} />
            </label>
          </div>
        </Formulario>
      )}
    </>
  );
}
