import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  LoaderCircle,
  RefreshCw,
  ShieldX,
  Inbox,
} from "lucide-react";
import { ApiError, ContratoError } from "./api";
import type { Pagina } from "./contratos";

export const numero = (valor: number | string | null, decimales = 0) =>
  valor === null
    ? "Sin dato"
    : new Intl.NumberFormat("es-HN", {
        minimumFractionDigits: decimales,
        maximumFractionDigits: decimales,
      }).format(Number(valor));
export const temperatura = (valor: string | null) =>
  valor === null ? "Sin lectura" : `${numero(valor, 2)} °C`;
export const fechaHora = (valor: string, zona: string) => {
  try {
    return new Intl.DateTimeFormat("es-HN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: zona,
    }).format(new Date(valor));
  } catch {
    return valor;
  }
};
export const fecha = (valor: string) => {
  try {
    return new Intl.DateTimeFormat("es-HN", {
      dateStyle: "long",
      timeZone: "UTC",
    }).format(new Date(`${valor}T12:00:00Z`));
  } catch {
    return valor;
  }
};
export const estados: Record<string, string> = {
  OFFLINE: "Desconectado",
  AVAILABLE: "Disponible",
  ON_ROUTE: "En ruta",
  PAUSED: "En pausa",
  OUT_OF_SERVICE: "Fuera de servicio",
  EMPTY: "Sin carga",
  AVAILABLE_SPACE: "Con espacio",
  FULL: "Ocupado",
};
export function Etiqueta({
  children,
  tono = "",
}: {
  children: ReactNode;
  tono?: string;
}) {
  return <span className={`etiqueta ${tono}`}>{children}</span>;
}
export function Cargando({
  texto = "Consultando información…",
}: {
  texto?: string;
}) {
  return (
    <div className="estado" role="status">
      <LoaderCircle className="girar" size={26} aria-hidden="true" />
      <p>{texto}</p>
    </div>
  );
}
export function Vacio({
  titulo = "No hay resultados",
  texto = "Prueba otra fecha o ajusta los filtros.",
}: {
  titulo?: string;
  texto?: string;
}) {
  return (
    <div className="estado">
      <Inbox size={32} aria-hidden="true" />
      <h3>{titulo}</h3>
      <p>{texto}</p>
    </div>
  );
}
export function ErrorVista({
  error,
  reintentar,
}: {
  error: unknown;
  reintentar?: () => void;
}) {
  const esApi = error instanceof ApiError;
  const campos =
    esApi && error.status < 500
      ? Object.entries(error.campos).filter(
          ([clave]) => !["detail", "segundos_espera"].includes(clave),
        )
      : [];
  return (
    <div className="error-vista" role="alert">
      <div className="error-titulo">
        {esApi && error.status === 403 ? (
          <ShieldX size={22} aria-hidden="true" />
        ) : (
          <AlertCircle size={22} aria-hidden="true" />
        )}
        <strong>
          {esApi || error instanceof ContratoError
            ? error.message
            : "No se pudo completar la consulta."}
        </strong>
      </div>
      {error instanceof ContratoError && (
        <p>
          Campos incompatibles: {error.rutas.join(", ")}. El contrato de estos
          campos necesita revisión.
        </p>
      )}
      {campos.length > 0 && (
        <ul>
          {campos.map(([campo, valor]) => (
            <li key={campo}>
              <a href={`#${campo}`}>{campo}</a>:{" "}
              {Array.isArray(valor)
                ? valor.join(" ")
                : typeof valor === "string"
                  ? valor
                  : JSON.stringify(valor)}
            </li>
          ))}
        </ul>
      )}
      {reintentar && (
        <button type="button" className="boton secundario" onClick={reintentar}>
          <RefreshCw size={16} aria-hidden="true" />
          Volver a intentar
        </button>
      )}
    </div>
  );
}
export function ErrorCampo({
  error,
  campo,
}: {
  error: unknown;
  campo: string;
}) {
  const valor = error instanceof ApiError ? error.campos[campo] : null;
  return valor ? (
    <span className="error-campo" id={`${campo}-error`}>
      {Array.isArray(valor) ? valor.join(" ") : String(valor)}
    </span>
  ) : null;
}
export function Paginacion({
  datos,
  pagina,
  tamano,
  cambiar,
}: {
  datos: Pagina<unknown>;
  pagina: number;
  tamano: number;
  cambiar: (pagina: number) => void;
}) {
  return (
    <div className="paginacion">
      <span>
        {numero(datos.conteo)} registros · Página {pagina}
        {datos.conteo > 0 && ` de ${Math.ceil(datos.conteo / tamano)}`}
      </span>
      <div>
        <button
          className="boton secundario"
          disabled={datos.pagina_anterior === null}
          onClick={() => cambiar(Math.max(1, pagina - 1))}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Anterior
        </button>
        <button
          className="boton secundario"
          disabled={datos.pagina_siguiente === null}
          onClick={() => cambiar(pagina + 1)}
        >
          Siguiente
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
export function useConsulta<T>(
  cargar: (signal: AbortSignal) => Promise<T>,
  clave: string,
) {
  const [estado, setEstado] = useState<{
    clave: string;
    datos?: T;
    error?: unknown;
    cargando: boolean;
  }>({ clave, cargando: true });
  const [version, setVersion] = useState(0);
  const cargarRef = useRef(cargar);
  cargarRef.current = cargar;
  useEffect(() => {
    const controller = new AbortController();
    let vigente = true;
    setEstado({ clave, cargando: true });
    cargarRef
      .current(controller.signal)
      .then((datos) => {
        if (vigente) setEstado({ clave, datos, cargando: false });
      })
      .catch((error) => {
        if (vigente && !controller.signal.aborted)
          setEstado({ clave, error, cargando: false });
      });
    return () => {
      vigente = false;
      controller.abort();
    };
  }, [clave, version]);
  const actual = estado.clave === clave ? estado : { clave, cargando: true };
  return { ...actual, recargar: () => setVersion((v) => v + 1) };
}
export function Panel({
  titulo,
  children,
  extra,
  className = "",
}: {
  titulo: string;
  children: ReactNode;
  extra?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`} aria-label={titulo}>
      <div className="panel-cabecera">
        <h2>{titulo}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}
export function Metrica({
  etiqueta,
  valor,
  nota,
}: {
  etiqueta: string;
  valor: ReactNode;
  nota?: string;
}) {
  return (
    <div className="metrica">
      <span>{etiqueta}</span>
      <strong>{valor}</strong>
      {nota && <small>{nota}</small>}
    </div>
  );
}
