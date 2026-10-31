import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { cargarMonitoreo, type LoteMonitoreo } from "./monitoreo";
import { useAuth } from "./auth";
import { puedeElegirEmpresa } from "./permisos";

export function useMonitoreo() {
  const { perfil } = useAuth();
  const empresa = puedeElegirEmpresa(perfil) ? undefined : perfil?.empresa?.id;
  const [version, setVersion] = useState(0);
  const [automatico, guardarAutomatico] = useState(true);
  const automaticoActual = useRef(true);
  const [visible, setVisible] = useState(
    () => document.visibilityState !== "hidden",
  );
  const [estado, setEstado] = useState<{
    datos?: LoteMonitoreo;
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
        const datos = await cargarMonitoreo(
          api.solicitar,
          control.signal,
          empresa,
        );
        if (control.signal.aborted) return;
        setEstado({ datos, cargando: false, actualizado: Date.now() });
        if (automaticoActual.current)
          timer = setTimeout(
            () => {
              if (automaticoActual.current) void cargar();
            },
            Math.min(2147483647, datos.intervalo * 1000),
          );
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
  }, [version, visible, empresa]);
  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  const setAutomatico = useCallback((valor: boolean) => {
    automaticoActual.current = valor;
    guardarAutomatico(valor);
    if (valor) setVersion((v) => v + 1);
  }, []);
  return { ...estado, automatico, setAutomatico, visible, recargar };
}
