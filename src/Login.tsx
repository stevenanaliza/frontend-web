import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  LoaderCircle,
} from "lucide-react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./auth";
import { api, ApiError, configuracionError } from "./api";
import { ErrorCampo, ErrorVista } from "./componentes";
import { rutaInicial } from "./permisos";
import { useEsperaReintento } from "./useEsperaReintento";

export function Marca({ grande = false }: { grande?: boolean }) {
  return (
    <div className={`marca ${grande ? "grande" : ""}`}>
      <img src="/marca-corporate.png" alt="" width="42" height="42" />
      <div>
        <span>
          Vita<span className="marca-go">Go</span>
        </span>
        <small>CORPORATE</small>
      </div>
    </div>
  );
}
export function Login() {
  const { perfil, iniciar } = useAuth();
  const [error, setError] = useState<unknown>(null);
  const esperaCierre = useEsperaReintento(error);
  const [ocupado, setOcupado] = useState(false);
  const [mostrar, setMostrar] = useState(false);
  const [espera, setEspera] = useState(0);
  const resumen = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!espera) return;
    const fin = performance.now() + espera * 1000;
    const timer = window.setInterval(
      () => setEspera(Math.max(0, Math.ceil((fin - performance.now()) / 1000))),
      250,
    );
    return () => clearInterval(timer);
  }, [espera]);
  if (perfil) return <Navigate to={rutaInicial(perfil)} replace />;
  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (ocupado || espera || esperaCierre) return;
    const campos = new FormData(event.currentTarget);
    setOcupado(true);
    setError(null);
    try {
      await iniciar(
        String(campos.get("correo")).trim(),
        String(campos.get("contrasena")),
      );
    } catch (e) {
      setError(e);
      if (e instanceof ApiError && e.status === 429) setEspera(e.espera);
      requestAnimationFrame(() => resumen.current?.focus());
    } finally {
      setOcupado(false);
    }
  }
  return (
    <main className="login">
      <section className="login-presentacion">
        <Marca grande />
        <div className="login-mensaje">
          <h1>
            Cada traslado,
            <br />
            con su historia completa.
          </h1>
          <p>
            Revisa la actividad de tus motoristas, la carga de tubos y frascos y
            las lecturas de temperatura desde un solo lugar.
          </p>
          <div className="login-grafico" aria-hidden="true">
            <div className="linea-ruta" />
            <span className="nodo uno" />
            <span className="nodo dos" />
            <span className="nodo tres" />
            <div className="ruta-texto">
              Origen <ArrowRight size={18} /> Recolección{" "}
              <ArrowRight size={18} /> Entrega
            </div>
          </div>
        </div>
        <div className="login-pie">
          <ShieldCheck size={18} aria-hidden="true" />
          Acceso administrativo · VitaGo Corporate
        </div>
      </section>
      <section className="login-formulario">
        <div className="form-contenedor">
          <div className="icono-login">
            <LockKeyhole size={24} aria-hidden="true" />
          </div>
          <h2>Inicia sesión</h2>
          <p className="muted">
            Ingresa con tu cuenta administrativa de Corporate.
          </p>
          {!api.configurado && (
            <div className="aviso" role="status">
              <strong>Configuración pendiente</strong>
              <p>
                {configuracionError() ||
                  "Falta la dirección del backend Corporate."}{" "}
                Configura <code>VITE_API_URL</code> en el archivo{" "}
                <code>.env.local</code> y reinicia el panel.
              </p>
            </div>
          )}
          <form onSubmit={enviar}>
            {error != null && (
              <div ref={resumen} tabIndex={-1}>
                <ErrorVista error={error} />
              </div>
            )}
            <label htmlFor="correo">Correo electrónico</label>
            <input
              id="correo"
              name="correo"
              type="email"
              autoComplete="username"
              maxLength={254}
              placeholder="nombre@empresa.com"
              required
              aria-describedby="correo-error"
            />
            <ErrorCampo error={error} campo="correo" />
            <label htmlFor="contrasena">Contraseña</label>
            <div className="campo-password">
              <input
                id="contrasena"
                name="contrasena"
                type={mostrar ? "text" : "password"}
                autoComplete="current-password"
                maxLength={128}
                required
                aria-describedby="contrasena-error"
              />
              <button
                type="button"
                aria-label={
                  mostrar ? "Ocultar contraseña" : "Mostrar contraseña"
                }
                onClick={() => setMostrar(!mostrar)}
              >
                {mostrar ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
            <ErrorCampo error={error} campo="contrasena" />
            <button
              className="boton primario login-enviar"
              disabled={
                ocupado || espera > 0 || esperaCierre > 0 || !api.configurado
              }
            >
              {ocupado ? (
                <LoaderCircle className="girar" size={18} aria-hidden="true" />
              ) : null}
              {ocupado
                ? "Verificando acceso…"
                : espera || esperaCierre
                  ? `Intenta de nuevo en ${Math.max(espera, esperaCierre)} s`
                  : "Entrar al panel"}
              {!ocupado && !espera && (
                <ArrowRight size={18} aria-hidden="true" />
              )}
            </button>
          </form>
          <p className="nota-acceso">
            <ShieldCheck size={16} aria-hidden="true" />
            El acceso requiere permisos administrativos vigentes.
          </p>
        </div>
        <small className="login-copyright">
          VitaGo Corporate · Administración web
        </small>
      </section>
    </main>
  );
}
