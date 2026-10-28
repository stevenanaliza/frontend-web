import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { cargarMonitoreo, type MotoristaMonitor } from "./monitoreo";

export function useMonitoreo() {
  const [version, setVersion] = useState(0);
  const [automatico, guardarAutomatico] = useState(true);
  const automaticoActual = useRef(true);
  const [visible, setVisible] = useState(
    () => document.visibilityState !== "hidden",
  );
  const [estado, setEstado] = useState<{
    datos?: MotoristaMonitor[];
    error?: unknown;
    cargando: boolean;
    actualizado?: number;
  }>({ cargando: true });
  useEffect(() => {
    const cambiar = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", cambiar);
    return () => document.removeEventListener("visibilitychange", cambiar);
  }, []);
  useEffect(() => {
    if (!visible) return;
    const control = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function cargar() {
      setEstado((anterior) => ({
        ...anterior,
        cargando: true,
        error: undefined,
      }));
      try {
        const datos = await cargarMonitoreo(api.solicitar, control.signal);
        if (control.signal.aborted) return;
        setEstado({ datos, cargando: false, actualizado: Date.now() });
        if (automaticoActual.current && !datos.some((d) => d.errorGps))
          timer = setTimeout(() => {
            if (automaticoActual.current) void cargar();
          }, 15_000);
      } catch (error) {
        if (!control.signal.aborted) {
          setEstado({ error, cargando: false });
          control.abort();
        }
      }
    }
    void cargar();
    return () => {
      control.abort();
      clearTimeout(timer);
    };
  }, [version, visible]);
  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  const setAutomatico = useCallback((valor: boolean) => {
    automaticoActual.current = valor;
    guardarAutomatico(valor);
    if (valor) setVersion((v) => v + 1);
  }, []);
  return { ...estado, automatico, setAutomatico, visible, recargar };
}
