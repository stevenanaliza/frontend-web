import { ApiError, ContratoError, parsear } from "./errores";
export { ApiError, ContratoError, parsear } from "./errores";
import { tokensSchema, type Tokens } from "./contratos";

export function crearCliente(
  origen: string,
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  fetcher: typeof fetch = fetch,
  usarProxy = false,
) {
  let base = "";
  if (origen) {
    try {
      const url = new URL(origen);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        !["/", ""].includes(url.pathname)
      )
        throw Error();
      base = url.origin;
    } catch {
      throw new Error(
        "VITE_API_URL debe ser el origen HTTP(S) del backend, sin rutas ni credenciales.",
      );
    }
  }
  const clave = `vitago:corporate:${base}:sesion`;
  let tokens: Tokens | null = null;
  let renovando: Promise<void> | null = null;
  let versionSesion = 0;
  let alPerderSesion = () => {};
  try {
    const guardado = storage?.getItem(clave);
    if (guardado) tokens = parsear(tokensSchema, JSON.parse(guardado));
  } catch {
    try {
      storage?.removeItem(clave);
    } catch {
      /* Almacenamiento bloqueado. */
    }
  }
  function guardar(nuevos: Tokens | null) {
    tokens = nuevos;
    try {
      if (nuevos) storage?.setItem(clave, JSON.stringify(nuevos));
      else storage?.removeItem(clave);
    } catch {
      /* Si el navegador impide persistir, se conserva únicamente en memoria. */
    }
  }
  function limpiar() {
    versionSesion++;
    renovando = null;
    guardar(null);
    alPerderSesion();
  }
  async function enviar(
    ruta: string,
    init: RequestInit = {},
    autorizado = false,
    binario = false,
  ) {
    if (!base)
      throw new ApiError(0, {
        detail: "Falta configurar la URL del backend Corporate.",
      });
    if (
      !ruta.startsWith("/api/v1/") ||
      ruta.includes("://") ||
      ruta.includes("..")
    )
      throw Error("Ruta de API no permitida");
    const headers = new Headers(init.headers);
    headers.set("Accept", binario ? "*/*" : "application/json");
    if (init.body) headers.set("Content-Type", "application/json");
    if (autorizado && tokens)
      headers.set("Authorization", `Bearer ${tokens.token_acceso}`);
    let respuesta: Response;
    try {
      respuesta = await fetcher(`${usarProxy ? "" : base}${ruta}`, {
        ...init,
        headers,
        credentials: "omit",
        redirect: "error",
        cache: "no-store",
        signal: init.signal
          ? AbortSignal.any([init.signal, AbortSignal.timeout(20_000)])
          : AbortSignal.timeout(20_000),
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw e;
      throw new ApiError(0);
    }
    if (respuesta.status === 204) return undefined;
    if (respuesta.ok && binario) {
      const tipo = respuesta.headers
        .get("Content-Type")
        ?.split(";")[0]
        .trim()
        .toLowerCase();
      if (!tipo || !["image/jpeg", "image/png", "image/webp"].includes(tipo))
        throw new ContratoError(["Content-Type de evidencia"]);
      return await respuesta.blob();
    }
    let datos: unknown;
    try {
      datos = await respuesta.json();
    } catch {
      if (respuesta.ok) throw new ContratoError(["JSON"]);
      throw new ApiError(respuesta.status);
    }
    if (!respuesta.ok) {
      const campos =
        datos && typeof datos === "object" && !Array.isArray(datos)
          ? (datos as Record<string, unknown>)
          : {};
      const retry = respuesta.headers.get("Retry-After");
      const espera = retry
        ? /^\d+$/.test(retry)
          ? Number(retry)
          : Math.max(0, (Date.parse(retry) - Date.now()) / 1000)
        : Number(campos.segundos_espera ?? 0);
      throw new ApiError(
        respuesta.status,
        campos,
        Number.isFinite(espera) ? Math.ceil(espera) : 0,
      );
    }
    return datos;
  }
  async function renovar() {
    if (renovando) return renovando;
    const actuales = tokens;
    if (
      !actuales ||
      Date.parse(actuales.expira_token_refresco_en) <= Date.now()
    ) {
      limpiar();
      throw new ApiError(401);
    }
    const version = versionSesion;
    const proceso = (async () => {
      try {
        const datos = await enviar("/api/v1/autenticacion/renovar/", {
          method: "POST",
          body: JSON.stringify({ token_refresco: actuales.token_refresco }),
        });
        if (versionSesion !== version || tokens !== actuales)
          throw new ApiError(401);
        guardar(parsear(tokensSchema, datos));
      } catch (error) {
        if (versionSesion === version) limpiar();
        throw error;
      }
    })();
    renovando = proceso;
    try {
      return await proceso;
    } finally {
      if (renovando === proceso) renovando = null;
    }
  }
  async function solicitar(
    ruta: string,
    init: RequestInit = {},
    binario = false,
  ) {
    if (!tokens) throw new ApiError(401);
    const version = versionSesion;
    let renovo = false;
    if (Date.parse(tokens.expira_token_acceso_en) <= Date.now()) {
      await renovar();
      renovo = true;
    }
    if (versionSesion !== version) throw new ApiError(401);
    const usado = tokens?.token_acceso;
    try {
      const datos = await enviar(ruta, init, true, binario);
      if (versionSesion !== version) throw new ApiError(401);
      return datos;
    } catch (error) {
      if (versionSesion !== version) throw error;
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      // Únicamente GET puede repetirse. Nunca reintentar automáticamente una mutación.
      if ((init.method ?? "GET").toUpperCase() !== "GET" || !tokens || renovo) {
        limpiar();
        throw error;
      }
      if (tokens?.token_acceso === usado) await renovar();
      if (versionSesion !== version) throw new ApiError(401);
      try {
        const datos = await enviar(ruta, init, true, binario);
        if (versionSesion !== version) throw new ApiError(401);
        return datos;
      } catch (segundo) {
        if (
          versionSesion === version &&
          segundo instanceof ApiError &&
          segundo.status === 401
        )
          limpiar();
        throw segundo;
      }
    }
  }
  return {
    base,
    configurado: Boolean(base),
    tieneSesion: () => Boolean(tokens),
    solicitar,
    archivo: async (ruta: string, signal?: AbortSignal) => {
      const resultado = await solicitar(ruta, { signal }, true);
      if (!(resultado instanceof Blob)) throw new ContratoError(["archivo"]);
      return resultado;
    },
    limpiar,
    escucharSesion: (callback: () => void) => {
      alPerderSesion = callback;
    },
    iniciar: async (correo: string, contrasena: string) => {
      const version = ++versionSesion;
      renovando = null;
      guardar(null);
      const datos = await enviar("/api/v1/autenticacion/iniciar-sesion/", {
        method: "POST",
        body: JSON.stringify({ correo, contrasena }),
      });
      if (versionSesion !== version) throw new ApiError(401);
      guardar(parsear(tokensSchema, datos));
    },
    cerrar: async () => {
      const version = versionSesion;
      await solicitar("/api/v1/autenticacion/cerrar-sesion/", {
        method: "POST",
      });
      if (versionSesion === version) limpiar();
    },
  };
}
let almacenamiento: Storage | undefined;
try {
  almacenamiento = globalThis.sessionStorage;
} catch {
  /* Modo privado: sesión en memoria. */
}
let errorConfiguracion = "";
function inicializar() {
  try {
    return crearCliente(
      import.meta.env.VITE_API_URL ?? "",
      almacenamiento,
      fetch,
      import.meta.env.DEV &&
        import.meta.env.MODE !== "prueba" &&
        import.meta.env.VITE_API_PROXY === "true",
    );
  } catch (error) {
    errorConfiguracion = (error as Error).message;
    return crearCliente("");
  }
}
export const api = inicializar();
export const configuracionError = () => errorConfiguracion;
export function consulta(filtros: Record<string, string | number>) {
  const params = new URLSearchParams();
  Object.entries(filtros).forEach(([k, v]) => {
    if (v !== "") params.set(k, String(v));
  });
  return params.size ? `?${params}` : "";
}
