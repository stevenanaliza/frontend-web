import {
  useEffect,
  useRef,
  useState,
  useId,
  type FormEvent,
  type ReactNode,
} from "react";
import { RefreshCw, Search, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "./auth";
import { puedeElegirEmpresa } from "./permisos";
import { api, consulta, parsear } from "./api";
import { empresaSchema } from "./contratos-admin";
import { paginaSchema } from "./contratos";
import {
  Cargando,
  ErrorCampo,
  ErrorVista,
  Paginacion,
  Vacio,
  useConsulta,
} from "./componentes";
import type { z } from "zod";

export const uuidPattern =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
export function Cabecera({
  titulo,
  texto,
  recargar,
  cargando = false,
  accion,
  nivel = 1,
}: {
  titulo: string;
  texto: string;
  recargar?: () => void;
  cargando?: boolean;
  accion?: ReactNode;
  nivel?: 1 | 2;
}) {
  const Titulo = nivel === 1 ? "h1" : "h2";
  return (
    <div className="pagina-cabecera">
      <div>
        <Titulo>{titulo}</Titulo>
        <p>{texto}</p>
      </div>
      <div className="acciones">
        {accion}
        {recargar && (
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
        )}
      </div>
    </div>
  );
}
export function usePaginaRemota<T>(
  ruta: string,
  schema: z.ZodType<T>,
  filtros: Record<string, string | number> = {},
  prefijo = "",
) {
  const nombrePagina = prefijo ? `pagina_${prefijo}` : "pagina";
  const [params, setParams] = useSearchParams();
  const pagina = Math.max(1, Math.trunc(Number(params.get(nombrePagina)) || 1));
  const tamano = [20, 50, 100].includes(Number(params.get("tamano_pagina")))
    ? Number(params.get("tamano_pagina"))
    : 20;
  const url = `${ruta}${consulta({ ...filtros, pagina, tamano_pagina: tamano })}`;
  const resultado = useConsulta(
    async (signal) =>
      parsear(paginaSchema(schema), await api.solicitar(url, { signal })),
    url,
  );
  return {
    ...resultado,
    pagina,
    tamano,
    cambiar: (nueva: number) => {
      const siguiente = new URLSearchParams(params);
      siguiente.set(nombrePagina, String(nueva));
      setParams(siguiente);
    },
  };
}
export function TablaRemota<T>({
  consulta: datosConsulta,
  children,
  tituloVacio = "Sin resultados",
}: {
  consulta: ReturnType<typeof usePaginaRemota<T>>;
  children: (datos: T[]) => ReactNode;
  tituloVacio?: string;
}) {
  const { cargando, error, datos, recargar, pagina, tamano, cambiar } =
    datosConsulta;
  return cargando ? (
    <Cargando />
  ) : error ? (
    <ErrorVista error={error} reintentar={recargar} />
  ) : datos ? (
    <>
      {datos.resultados.length ? (
        children(datos.resultados)
      ) : (
        <Vacio titulo={tituloVacio} />
      )}
      <Paginacion
        datos={datos}
        pagina={pagina}
        tamano={tamano}
        cambiar={cambiar}
      />
    </>
  ) : null;
}
export function Filtros({
  children,
  error,
  empresa = false,
  conservar = [],
}: {
  children?: ReactNode;
  error?: unknown;
  empresa?: boolean;
  conservar?: string[];
}) {
  const { perfil } = useAuth();
  const idTamano = `${useId()}-tamano-pagina`;
  const [params, setParams] = useSearchParams();
  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const siguientes = new URLSearchParams(params);
    [...siguientes.keys()]
      .filter((k) => k === "pagina" || k.startsWith("pagina_"))
      .forEach((k) => siguientes.delete(k));
    new FormData(event.currentTarget).forEach((valor, clave) => {
      if (
        clave === "empresa_id" &&
        String(valor) !== (params.get("empresa_id") ?? "")
      )
        ["grupo", "nombre_grupo"].forEach((k) => siguientes.delete(k));
      if (valor === "") siguientes.delete(clave);
      else siguientes.set(clave, String(valor));
    });
    if (empresa && !puedeElegirEmpresa(perfil)) {
      siguientes.delete("empresa_id");
    }
    setParams(siguientes);
  }
  return (
    <section className="panel filtros" aria-label="Filtros">
      <form key={params.toString()} onSubmit={enviar}>
        <div className="filtros-fila">
          {empresa && puedeElegirEmpresa(perfil) && (
            <label htmlFor="empresa_id">
              ID de empresa
              <input
                id="empresa_id"
                name="empresa_id"
                defaultValue={params.get("empresa_id") ?? ""}
                pattern={uuidPattern}
                placeholder="Todas las empresas autorizadas"
              />
              <ErrorCampo error={error} campo="empresa_id" />
            </label>
          )}
          {children}
          <label htmlFor={idTamano}>
            Filas por página
            <select
              id={idTamano}
              name="tamano_pagina"
              defaultValue={params.get("tamano_pagina") ?? "20"}
            >
              <option>20</option>
              <option>50</option>
              <option>100</option>
            </select>
          </label>
          <button className="boton primario">
            <Search size={16} aria-hidden="true" />
            Aplicar filtros
          </button>
          {params.size > 0 && (
            <button
              type="button"
              className="boton texto"
              onClick={() => {
                const nuevos = new URLSearchParams();
                conservar.forEach((k) => {
                  const valor = params.get(k);
                  if (valor !== null) nuevos.set(k, valor);
                });
                setParams(nuevos);
              }}
            >
              <X size={16} aria-hidden="true" />
              Limpiar
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
export function ErroresFormulario({ error }: { error: unknown }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) ref.current?.focus();
  }, [error]);
  return error ? (
    <div ref={ref} tabIndex={-1}>
      <ErrorVista error={error} />
    </div>
  ) : null;
}
export function Campo({
  nombre,
  etiqueta,
  error,
  ...props
}: { nombre: string; etiqueta: string; error?: unknown } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "name" | "id"
>) {
  return (
    <label className="campo-form" htmlFor={nombre}>
      {etiqueta}
      <input
        {...props}
        id={nombre}
        name={nombre}
        aria-invalid={Boolean(
          error &&
          typeof error === "object" &&
          "campos" in error &&
          (error.campos as Record<string, unknown>)[nombre],
        )}
        aria-describedby={`${nombre}-error`}
      />
      <ErrorCampo error={error} campo={nombre} />
    </label>
  );
}
export function SelectorEmpresa({
  seleccionar,
}: {
  seleccionar: (id: string) => void;
}) {
  const { perfil } = useAuth();
  const [id, setId] = useState("");
  if (!puedeElegirEmpresa(perfil)) {
    return (
      <section className="panel selector-empresa">
        <h2>Empresa</h2>
        <p>{perfil?.empresa?.nombre ?? "No tienes empresa asignada."}</p>
      </section>
    );
  }
  return (
    <section className="panel selector-empresa">
      <h2>Selecciona la empresa</h2>
      <p>Consulta sus sucursales dentro de tu alcance autorizado.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          seleccionar(id);
        }}
      >
        <Campo
          nombre="empresa_id"
          etiqueta="ID de empresa"
          value={id}
          onChange={(event) => setId(event.target.value)}
          pattern={uuidPattern}
          required
        />
        <button className="boton primario">Consultar sucursales</button>
      </form>
      {perfil?.permisos.includes("empresa.ver") && (
        <Empresas seleccionar={seleccionar} />
      )}
    </section>
  );
}
function Empresas({ seleccionar }: { seleccionar: (id: string) => void }) {
  const listado = usePaginaRemota(
    "/api/v1/organizaciones/empresas/",
    empresaSchema,
  );
  return (
    <TablaRemota consulta={listado}>
      {(empresas) => (
        <div className="lista-empresas">
          {empresas.map((empresa) => (
            <button
              key={empresa.id}
              className="boton secundario"
              onClick={() => seleccionar(empresa.id)}
            >
              {empresa.nombre}
            </button>
          ))}
        </div>
      )}
    </TablaRemota>
  );
}
