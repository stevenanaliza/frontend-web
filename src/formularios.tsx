import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import type { z } from "zod";
import { api, consulta, parsear } from "./api";
import { paginaSchema } from "./contratos";
import { empresaSchema, sucursalSchema } from "./contratos-admin";
import { useAuth } from "./auth";
import { Campo, ErroresFormulario, uuidPattern } from "./admin-comunes";
import {
  Cargando,
  ErrorCampo,
  ErrorVista,
  Vacio,
  useConsulta,
} from "./componentes";

export function useOperacion() {
  const [ocupado, setOcupado] = useState(false),
    [error, setError] = useState<unknown>(null);
  const enCurso = useRef(false);
  async function ejecutar(operacion: () => Promise<void>) {
    if (enCurso.current) return;
    enCurso.current = true;
    setOcupado(true);
    setError(null);
    try {
      await operacion();
    } catch (e) {
      setError(e);
    } finally {
      enCurso.current = false;
      setOcupado(false);
    }
  }
  return { ocupado, error, setError, ejecutar };
}
export function Formulario({
  titulo,
  children,
  operacion,
  enviar,
  cancelar,
  textoGuardar = "Guardar",
  aviso,
}: {
  titulo: string;
  children: ReactNode;
  operacion: ReturnType<typeof useOperacion>;
  enviar: (datos: FormData) => Promise<void>;
  cancelar?: () => void;
  textoGuardar?: string;
  aviso?: ReactNode;
}) {
  function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const datos = new FormData(event.currentTarget);
    void operacion.ejecutar(() => enviar(datos));
  }
  return (
    <section className="panel formulario-edicion" aria-label={titulo}>
      <div className="panel-cabecera">
        <h2>{titulo}</h2>
      </div>
      <form onSubmit={guardar}>
        <ErroresFormulario error={operacion.error} />
        {aviso}
        <fieldset className="campos-operacion" disabled={operacion.ocupado}>
          {children}
        </fieldset>
        <div className="acciones-form">
          {cancelar && (
            <button
              type="button"
              className="boton secundario"
              disabled={operacion.ocupado}
              onClick={cancelar}
            >
              Cancelar
            </button>
          )}
          <button className="boton primario" disabled={operacion.ocupado}>
            {operacion.ocupado ? "Guardando…" : textoGuardar}
          </button>
        </div>
      </form>
    </section>
  );
}
export function Exito({ children }: { children: ReactNode }) {
  return (
    <div className="exito" role="status">
      <Check size={18} aria-hidden="true" />
      {children}
    </div>
  );
}
export function Password({
  nombre = "contrasena_temporal",
  etiqueta = "Contraseña temporal",
  error,
}: {
  nombre?: string;
  etiqueta?: string;
  error?: unknown;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-form">
      <Campo
        nombre={nombre}
        etiqueta={etiqueta}
        type={visible ? "text" : "password"}
        autoComplete="new-password"
        maxLength={128}
        required
        error={error}
      />
      <button
        type="button"
        className="boton texto"
        aria-label={
          visible
            ? `Ocultar ${etiqueta.toLocaleLowerCase("es")}`
            : `Mostrar ${etiqueta.toLocaleLowerCase("es")}`
        }
        onClick={() => setVisible(!visible)}
      >
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}
export function SelectorRemoto<T>({
  ruta,
  schema,
  filtros = {},
  nombre,
  etiqueta,
  valor,
  cambiar,
  describir,
  identificar,
  permitido,
  valorNombre,
  error,
}: {
  ruta: string;
  schema: z.ZodType<T>;
  filtros?: Record<string, string | number>;
  nombre: string;
  etiqueta: string;
  valor: string;
  cambiar: (id: string, item: T) => void;
  describir: (item: T) => string;
  identificar?: (item: T) => string;
  permitido?: (item: T) => boolean;
  valorNombre?: string;
  error?: unknown;
}) {
  const [pagina, setPagina] = useState(1);
  const url = `${ruta}${consulta({ ...filtros, pagina, tamano_pagina: 20 })}`;
  const listado = useConsulta(
    async (signal) =>
      parsear(paginaSchema(schema), await api.solicitar(url, { signal })),
    url,
  );
  const items = listado.datos?.resultados ?? [];
  const clave = identificar ?? ((item: T) => (item as { id: string }).id);
  return (
    <fieldset className="selector-remoto" id={nombre} tabIndex={-1}>
      <legend>{etiqueta}</legend>
      {valor && (
        <p className="seleccion-actual">
          Seleccionado:{" "}
          {valorNombre ??
            (items
              .filter((i) => clave(i) === valor)
              .map(describir)
              .join("") ||
              valor)}
        </p>
      )}
      {listado.cargando ? (
        <Cargando texto="Consultando opciones…" />
      ) : listado.error ? (
        <ErrorVista error={listado.error} reintentar={listado.recargar} />
      ) : (
        <>
          {items.length === 0 ? (
            <Vacio
              titulo="Sin opciones disponibles"
              texto="No hay registros en esta página dentro de tu alcance."
            />
          ) : (
            <div className="opciones-remotas">
              {items.map((item) => {
                const id = clave(item),
                  disponible = permitido ? permitido(item) : true;
                return (
                  <label
                    className={`opcion-remota ${valor === id ? "elegida" : ""}`}
                    key={id}
                  >
                    <input
                      type="radio"
                      name={`opcion_${nombre}`}
                      checked={valor === id}
                      disabled={!disponible}
                      onChange={() => cambiar(id, item)}
                    />
                    <span>
                      {describir(item)}
                      {!disponible && (
                        <small>No elegible para esta operación</small>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          {listado.datos && (
            <div className="paginas-selector">
              <span>
                {listado.datos.conteo} registros · Página {pagina}
              </span>
              <button
                type="button"
                className="boton secundario"
                aria-label={`Página anterior de ${etiqueta.toLocaleLowerCase("es")}`}
                disabled={!listado.datos.pagina_anterior}
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
              >
                Anterior
              </button>
              <button
                type="button"
                className="boton secundario"
                aria-label={`Página siguiente de ${etiqueta.toLocaleLowerCase("es")}`}
                disabled={!listado.datos.pagina_siguiente}
                onClick={() => setPagina((p) => p + 1)}
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}
      <ErrorCampo error={error} campo={nombre} />
    </fieldset>
  );
}
export type Alcance = {
  tipo_alcance: "GLOBAL" | "EMPRESA" | "SUCURSAL";
  empresa_id: string;
  sucursal_id: string;
};
export function useAlcance(inicial?: Partial<Alcance>) {
  const { perfil } = useAuth();
  return useState<Alcance>({
    tipo_alcance:
      inicial?.tipo_alcance ?? (perfil?.sucursal ? "SUCURSAL" : "EMPRESA"),
    empresa_id: inicial?.empresa_id ?? perfil?.empresa?.id ?? "",
    sucursal_id: inicial?.sucursal_id ?? perfil?.sucursal?.id ?? "",
  });
}
export function payloadAlcance(alcance: Alcance) {
  return {
    tipo_alcance: alcance.tipo_alcance,
    empresa_id: alcance.tipo_alcance === "GLOBAL" ? null : alcance.empresa_id,
    sucursal_id:
      alcance.tipo_alcance === "SUCURSAL" ? alcance.sucursal_id : null,
  };
}
export function EmpresaCampo({
  valor,
  cambiar,
  error,
}: {
  valor: string;
  cambiar: (id: string) => void;
  error?: unknown;
}) {
  const { perfil } = useAuth();
  return (
    <div
      className="empresa-campo"
      id={perfil?.empresa?.id === valor ? "empresa_id" : undefined}
      tabIndex={-1}
    >
      {perfil?.empresa?.id === valor ? (
        <p className="contexto-form">
          <strong>Empresa:</strong> {perfil.empresa.nombre}
        </p>
      ) : (
        <Campo
          nombre="empresa_id"
          etiqueta="ID de empresa"
          value={valor}
          onChange={(e) => cambiar(e.target.value)}
          pattern={uuidPattern}
          required
          error={error}
        />
      )}
      <details>
        <summary>Seleccionar otra empresa autorizada</summary>
        {perfil?.permisos.includes("empresa.ver") ? (
          <SelectorRemoto
            ruta="/api/v1/organizaciones/empresas/"
            schema={empresaSchema}
            nombre="empresa_catalogo"
            etiqueta="Empresas"
            valor={valor}
            cambiar={(id) => cambiar(id)}
            describir={(e) => e.nombre}
          />
        ) : (
          <Campo
            nombre="empresa_contexto_id"
            etiqueta="ID de la empresa autorizada"
            pattern={uuidPattern}
            value={valor}
            onChange={(e) => cambiar(e.target.value)}
          />
        )}
      </details>
      <ErrorCampo error={error} campo="empresa_id" />
    </div>
  );
}
export function AlcanceCampos({
  valor,
  cambiar,
  error,
}: {
  valor: Alcance;
  cambiar: (alcance: Alcance) => void;
  error?: unknown;
}) {
  const { perfil } = useAuth();
  return (
    <>
      <label className="campo-form" htmlFor="tipo_alcance">
        Alcance
        <select
          id="tipo_alcance"
          value={valor.tipo_alcance}
          onChange={(e) =>
            cambiar({
              ...valor,
              tipo_alcance: e.target.value as Alcance["tipo_alcance"],
              sucursal_id: "",
            })
          }
        >
          <option value="EMPRESA">Empresa</option>
          <option value="SUCURSAL">Sucursal</option>
          <option value="GLOBAL">Global</option>
        </select>
        <ErrorCampo campo="tipo_alcance" error={error} />
      </label>
      {valor.tipo_alcance !== "GLOBAL" && (
        <EmpresaCampo
          valor={valor.empresa_id}
          cambiar={(id) =>
            cambiar({ ...valor, empresa_id: id, sucursal_id: "" })
          }
          error={error}
        />
      )}{" "}
      {valor.tipo_alcance === "SUCURSAL" &&
        valor.empresa_id &&
        (perfil?.permisos.includes("sucursal.ver") ? (
          <SelectorRemoto
            key={valor.empresa_id}
            ruta={`/api/v1/organizaciones/empresas/${encodeURIComponent(valor.empresa_id)}/sucursales/`}
            schema={sucursalSchema}
            nombre="sucursal_id"
            etiqueta="Sucursal del alcance"
            valor={valor.sucursal_id}
            cambiar={(id) => cambiar({ ...valor, sucursal_id: id })}
            describir={(s) => `${s.codigo} · ${s.nombre}`}
            error={error}
          />
        ) : (
          <Campo
            nombre="sucursal_id"
            etiqueta="ID de sucursal autorizada"
            value={valor.sucursal_id}
            onChange={(e) => cambiar({ ...valor, sucursal_id: e.target.value })}
            pattern={uuidPattern}
            required
            error={error}
          />
        ))}
    </>
  );
}
