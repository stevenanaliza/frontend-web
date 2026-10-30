import { useEffect, useState } from "react";
import { ApiError } from "./errores";

export function useEsperaReintento(error: unknown) {
  const fin =
    error instanceof ApiError && (error.cierrePendiente || error.status === 429)
      ? error.reintentarEn
      : 0;
  const [ahora, setAhora] = useState(() => performance.now());
  useEffect(() => {
    if (!fin) return;
    setAhora(performance.now());
    const timer = window.setInterval(() => {
      const nuevo = performance.now();
      setAhora(nuevo);
      if (nuevo >= fin) window.clearInterval(timer);
    }, 250);
    return () => window.clearInterval(timer);
  }, [fin]);
  return fin
    ? Math.max(0, Math.ceil((fin - Math.max(ahora, performance.now())) / 1000))
    : 0;
}
