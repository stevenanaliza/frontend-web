import { useCallback, useEffect, useRef, useState } from "react";
import {
  APIProvider,
  AdvancedMarker,
  Map,
  APILoadingStatus,
  useApiLoadingStatus,
  useMap,
} from "@vis.gl/react-google-maps";
import { Bike, LocateFixed } from "lucide-react";
import { Cargando } from "./componentes";
import { estadoGps, type MotoristaMonitor } from "./monitoreo";

type Props = {
  registros: MotoristaMonitor[];
  seleccionado: string | null;
  seleccionar: (id: string) => void;
  encuadre: number;
  ahora: number;
};
const bibliotecasMapa = ["marker"];
function Camara({ registros, seleccionado, encuadre }: Props) {
  const mapa = useMap();
  const ajustado = useRef(-1);
  const ultimo = useRef<string | null>(null);
  useEffect(() => {
    if (!mapa || !registros.length || ajustado.current === encuadre) return;
    const puntos = registros.flatMap((r) =>
      r.punto ? [{ lat: r.punto.latitud, lng: r.punto.longitud }] : [],
    );
    if (!puntos.length) return;
    if (puntos.length === 1) {
      mapa.setCenter(puntos[0]);
      mapa.setZoom(15);
    } else {
      mapa.fitBounds(
        {
          north: Math.max(...puntos.map((p) => p.lat)),
          south: Math.min(...puntos.map((p) => p.lat)),
          east: Math.max(...puntos.map((p) => p.lng)),
          west: Math.min(...puntos.map((p) => p.lng)),
        },
        64,
      );
    }
    ajustado.current = encuadre;
  }, [mapa, registros, encuadre]);
  useEffect(() => {
    if (!mapa || !seleccionado || ultimo.current === seleccionado) return;
    const punto = registros.find((r) => r.motorista.id === seleccionado)?.punto;
    if (punto) {
      mapa.panTo({ lat: punto.latitud, lng: punto.longitud });
      ultimo.current = seleccionado;
    }
  }, [mapa, registros, seleccionado]);
  return null;
}
function ContenidoMapa(props: Props) {
  const estado = useApiLoadingStatus();
  if (
    estado === APILoadingStatus.FAILED ||
    estado === APILoadingStatus.AUTH_FAILURE
  )
    return (
      <div className="monitor-mapa-estado" role="alert">
        <LocateFixed size={32} aria-hidden="true" />
        <h3>Google Maps no está disponible</h3>
        <p>
          Consulta los motoristas en el listado. Si el problema continúa,
          contacta al administrador del sistema.
        </p>
      </div>
    );
  if (estado !== APILoadingStatus.LOADED)
    return <Cargando texto="Cargando Google Maps…" />;
  const primero = props.registros.find((r) => r.punto)?.punto;
  return (
    <Map
      mapId={import.meta.env.VITE_GOOGLE_MAPS_MAP_ID?.trim() || "DEMO_MAP_ID"}
      defaultCenter={
        primero
          ? { lat: primero.latitud, lng: primero.longitud }
          : { lat: 0, lng: 0 }
      }
      defaultZoom={primero ? 13 : 2}
      gestureHandling="cooperative"
      streetViewControl={false}
      mapTypeControl={false}
      fullscreenControl={true}
      maxZoom={20}
      reuseMaps
      internalUsageAttributionIds={["gmp_git_agentskills_v1"]}
      style={{ width: "100%", height: "100%" }}
    >
      <Camara {...props} />
      {props.registros.map(
        (r) =>
          r.punto && (
            <AdvancedMarker
              key={r.motorista.id}
              position={{ lat: r.punto.latitud, lng: r.punto.longitud }}
              title={`Ver motorista ${r.motorista.usuario.nombres} ${r.motorista.usuario.apellidos}`}
              onClick={() => props.seleccionar(r.motorista.id)}
              zIndex={props.seleccionado === r.motorista.id ? 10 : 1}
            >
              <div
                aria-hidden="true"
                className={`monitor-pin ${props.seleccionado === r.motorista.id ? "seleccionado" : ""} ${estadoGps(r.punto, props.ahora) !== "Ubicación reciente" ? "antiguo" : ""}`}
              >
                <Bike size={23} />
                <span>{r.motorista.usuario.nombres}</span>
              </div>
            </AdvancedMarker>
          ),
      )}
    </Map>
  );
}

// Documentación: https://visgl.github.io/react-google-maps/docs/api-reference/components/advanced-marker
// Interacción actual: https://developers.google.com/maps/documentation/javascript/advanced-markers/accessible-markers?utm_campaign=gmp_git_agentskills_v1
// Usa AdvancedMarkerElement y mantiene la atribución y los controles de Google.
export default function MapaMotoristas(props: Props) {
  const [errorCarga, setErrorCarga] = useState(false);
  const falloCarga = useCallback(() => setErrorCarga(true), []);
  if (errorCarga)
    return (
      <div className="monitor-mapa-estado" role="alert">
        <LocateFixed size={32} aria-hidden="true" />
        <h3>Google Maps no está disponible</h3>
        <p>
          Consulta los motoristas en el listado. Si el problema continúa,
          contacta al administrador del sistema.
        </p>
      </div>
    );
  return (
    <APIProvider
      apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY.trim()}
      language="es"
      region="HN"
      version="weekly"
      libraries={bibliotecasMapa}
      onError={falloCarga}
    >
      <ContenidoMapa {...props} />
    </APIProvider>
  );
}
