import { useEffect, useState, type FormEvent } from "react";
import { Image, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { api } from "./api";
import { evidenciaSchema, type Evidencia } from "./contratos-admin";
import {
  Cabecera,
  Campo,
  TablaRemota,
  uuidPattern,
  usePaginaRemota,
} from "./admin-comunes";
import {
  Cargando,
  ErrorVista,
  Panel,
  fechaHora,
  numero,
  temperatura,
} from "./componentes";

const tipos: Record<string, string> = {
  FOTO_RECOLECCION: "Foto de recolección",
  FOTO_ENTREGA: "Foto de entrega",
  FOTO_INCIDENCIA: "Foto de incidencia",
};
function ImagenEvidencia({
  solicitudId,
  evidencia,
  cerrar,
}: {
  solicitudId: string;
  evidencia: Evidencia;
  cerrar: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let activa = true;
    let objectUrl: string | undefined;
    const abort = new AbortController();
    setUrl(null);
    setError(null);
    api
      .archivo(
        `/api/v1/solicitudes/${encodeURIComponent(solicitudId)}/evidencias/${encodeURIComponent(evidencia.id)}/archivo/`,
        abort.signal,
      )
      .then((blob) => {
        if (!activa) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((e) => {
        if (activa) setError(e);
      });
    return () => {
      activa = false;
      abort.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [solicitudId, evidencia.id, version]);
  return (
    <section className="visor-evidencia" aria-label="Imagen de evidencia">
      <div className="visor-titulo">
        <h3>{tipos[evidencia.tipo] ?? evidencia.tipo}</h3>
        <button type="button" className="boton secundario" onClick={cerrar}>
          <X size={17} aria-hidden="true" />
          Cerrar imagen
        </button>
      </div>
      {error ? (
        <ErrorVista error={error} reintentar={() => setVersion((v) => v + 1)} />
      ) : url ? (
        <img
          src={url}
          alt={`${tipos[evidencia.tipo] ?? evidencia.tipo} de la solicitud consultada`}
        />
      ) : (
        <Cargando texto="Cargando archivo protegido…" />
      )}
    </section>
  );
}
export function EvidenciasSolicitud({ solicitudId }: { solicitudId: string }) {
  const evidencias = usePaginaRemota(
    `/api/v1/solicitudes/${encodeURIComponent(solicitudId)}/evidencias/`,
    evidenciaSchema,
    {},
    "evidencias",
  );
  const [seleccion, setSeleccion] = useState<Evidencia | null>(null);
  useEffect(() => setSeleccion(null), [solicitudId]);
  return (
    <Panel titulo="Evidencias de la solicitud" className="separacion-panel">
      <TablaRemota
        consulta={evidencias}
        tituloVacio="Sin evidencias registradas"
      >
        {(items) => (
          <div
            className="tabla-scroll"
            role="region"
            aria-label="Evidencias registradas"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Evidencia</th>
                  <th>Hora oficial (UTC)</th>
                  <th>Temperatura</th>
                  <th>Archivo</th>
                </tr>
              </thead>
              <tbody>
                {items.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <strong>{tipos[e.tipo] ?? e.tipo}</strong>
                      <small className="celda-texto">
                        {e.notas ?? "Sin notas"}
                      </small>
                    </td>
                    <td>{fechaHora(e.capturada_en, "UTC")}</td>
                    <td>
                      {temperatura(e.temperatura_contenedor_c)}
                      <small>
                        {e.fuente_temperatura === "MANUAL"
                          ? "Manual"
                          : e.fuente_temperatura === "AUTOMATICA"
                            ? "Automática"
                            : (e.fuente_temperatura ?? "Sin fuente registrada")}
                      </small>
                    </td>
                    <td>
                      {e.archivo_disponible ? (
                        <button
                          className="boton secundario"
                          onClick={() => setSeleccion(e)}
                        >
                          <Image size={17} aria-hidden="true" />
                          Ver imagen
                        </button>
                      ) : (
                        <span>Archivo no disponible</span>
                      )}
                      <small>{numero(e.tamano_bytes / 1024, 1)} KB</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TablaRemota>
      {seleccion && (
        <ImagenEvidencia
          key={seleccion.id}
          solicitudId={solicitudId}
          evidencia={seleccion}
          cerrar={() => setSeleccion(null)}
        />
      )}
    </Panel>
  );
}
export function Evidencias() {
  const [params, setParams] = useSearchParams();
  const id = params.get("solicitud_id") ?? "";
  function consultar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setParams({
      solicitud_id: String(
        new FormData(event.currentTarget).get("solicitud_id"),
      ).trim(),
    });
  }
  return (
    <>
      <Cabecera
        titulo="Evidencias"
        texto="Consulta las fotografías y temperaturas registradas en una solicitud."
      />
      <section className="panel filtros">
        <form key={id} className="consulta-evidencia" onSubmit={consultar}>
          <Campo
            nombre="solicitud_id"
            etiqueta="Identificador de la solicitud"
            pattern={uuidPattern}
            defaultValue={id}
            required
          />
          <button className="boton primario">Consultar evidencias</button>
        </form>
        <p className="ayuda-form">
          También puedes abrir las evidencias desde el detalle de una solicitud.
        </p>
      </section>
      {id && <EvidenciasSolicitud key={id} solicitudId={id} />}
    </>
  );
}
