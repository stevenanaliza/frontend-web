import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, parsear } from "./api";
import { perfilSchema, type Perfil } from "./contratos";

type Auth = {
  perfil: Perfil | null;
  cargando: boolean;
  error: unknown;
  recuperar: () => Promise<void>;
  iniciar: (correo: string, contrasena: string) => Promise<void>;
  cerrar: () => Promise<void>;
};
const Contexto = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(api.tieneSesion());
  const [error, setError] = useState<unknown>(null);
  async function cargarPerfil() {
    const nuevo = parsear(
      perfilSchema,
      await api.solicitar("/api/v1/usuarios/mi-perfil/"),
    );
    setPerfil(nuevo);
  }
  async function recuperar() {
    setCargando(true);
    setError(null);
    try {
      if (api.tieneSesion()) await cargarPerfil();
    } catch (e) {
      setError(e);
    } finally {
      setCargando(false);
    }
  }
  useEffect(() => {
    api.escucharSesion(() => setPerfil(null));
    void recuperar();
    return () => api.escucharSesion(() => {});
  }, []);
  async function iniciar(correo: string, contrasena: string) {
    await api.iniciar(correo, contrasena);
    await cargarPerfil();
    setError(null);
  }
  async function cerrar() {
    await api.cerrar();
    setPerfil(null);
  }
  return (
    <Contexto.Provider
      value={{ perfil, cargando, error, recuperar, iniciar, cerrar }}
    >
      {children}
    </Contexto.Provider>
  );
}
export function useAuth() {
  const valor = useContext(Contexto);
  if (!valor) throw Error("Falta AuthProvider");
  return valor;
}
