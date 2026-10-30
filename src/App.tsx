import { useEsperaReintento } from "./useEsperaReintento";
import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useParams,
  useLocation,
} from "react-router-dom";
import {
  BarChart3,
  Building2,
  ChevronRight,
  FileText,
  Layers3,
  LogOut,
  Menu,
  PackageSearch,
  ShieldCheck,
  Truck,
  Users,
  MapPin,
  Bike,
  LayoutGrid,
  Utensils,
  X,
} from "lucide-react";
import { useAuth } from "./auth";
import { api } from "./api";
import { Cargando, ErrorVista, Panel, Vacio } from "./componentes";
import { Login, Marca } from "./Login";
import { Resumenes } from "./Resumenes";
import { DetalleMotorista } from "./DetalleMotorista";
import {
  modulosAdministrativos,
  puedeEntrar,
  puedeVerReportes,
  rutaInicial,
  tieneTodos,
  permisosMonitoreo,
} from "./permisos";
import { Solicitudes, DetalleSolicitud } from "./Solicitudes";
import { Motoristas } from "./Motoristas";
import { Usuarios, DetalleUsuario } from "./Usuarios";
import { Sucursales } from "./Sucursales";
import { Evidencias } from "./evidencias";
import { MiCuenta, NuevoUsuario } from "./GestionUsuarios";
import { NuevaSolicitud } from "./NuevaSolicitud";
import { Empresas, Ubicaciones } from "./Organizacion";
import { Vehiculos } from "./Vehiculos";
import { Administracion } from "./Administracion";
import { LimitesMotoristas } from "./LimitesMotoristas";
const Monitorear = lazy(() => import("./Monitorear"));
const Almuerzos = lazy(() => import("./PaginaAlmuerzos"));
const iconos = [
  PackageSearch,
  Users,
  Building2,
  Truck,
  FileText,
  Building2,
  MapPin,
  Bike,
];

function Proteccion() {
  const { perfil } = useAuth();
  if (!perfil) return <Navigate to="/iniciar-sesion" replace />;
  if (!puedeEntrar(perfil))
    return (
      <main className="acceso-denegado">
        <Marca />
        <Panel titulo="Acceso administrativo requerido">
          <Vacio
            titulo="Tu cuenta no tiene acceso al panel"
            texto="Solicita a un administrador que revise tus permisos. Una sesión de solicitante o motorista no concede acceso administrativo."
          />
          <CerrarSesion />
        </Panel>
      </main>
    );
  return <Outlet />;
}
function CerrarSesion() {
  const { cerrar } = useAuth();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<unknown>(null);
  return (
    <div className="cerrar-sesion">
      {error != null && <ErrorVista error={error} />}
      <button
        className="boton secundario"
        disabled={ocupado}
        onClick={async () => {
          setOcupado(true);
          setError(null);
          try {
            await cerrar();
          } catch (e) {
            setError(e);
          } finally {
            setOcupado(false);
          }
        }}
      >
        <LogOut size={17} aria-hidden="true" />
        {ocupado ? "Cerrando sesión…" : "Cerrar sesión"}
      </button>
      {error != null && (
        <button className="boton texto" onClick={() => api.limpiar()}>
          Salir de este navegador
        </button>
      )}
    </div>
  );
}
function Estructura() {
  const { perfil } = useAuth();
  const [menu, setMenu] = useState(false);
  const navegacion = useRef<HTMLElement>(null);
  const abrir = useRef<HTMLButtonElement>(null);
  const ubicacion = useLocation();
  useEffect(() => {
    document.getElementById("contenido")?.focus();
    window.scrollTo({ top: 0, left: 0 });
  }, [ubicacion.pathname]);
  useEffect(() => {
    if (!menu) return;
    navegacion.current
      ?.querySelector<HTMLButtonElement>(".cerrar-menu")
      ?.focus();
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function cerrarConEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenu(false);
        requestAnimationFrame(() => abrir.current?.focus());
      }
    }
    const media = window.matchMedia("(min-width: 1025px)");
    const ajustar = () => {
      if (media.matches) setMenu(false);
    };
    media.addEventListener("change", ajustar);
    document.addEventListener("keydown", cerrarConEscape);
    return () => {
      document.body.style.overflow = anterior;
      document.removeEventListener("keydown", cerrarConEscape);
      media.removeEventListener("change", ajustar);
    };
  }, [menu]);
  if (!perfil) return null;
  return (
    <div className="app">
      <a className="saltar" href="#contenido">
        Saltar al contenido
      </a>
      {menu && (
        <button
          className="fondo-menu"
          aria-label="Cerrar navegación"
          onClick={() => {
            setMenu(false);
            requestAnimationFrame(() => abrir.current?.focus());
          }}
        />
      )}
      <aside
        id="navegacion-principal"
        ref={navegacion}
        className={`sidebar ${menu ? "abierto" : ""}`}
        onKeyDown={(event) => {
          if (!menu || event.key !== "Tab") return;
          const elementos = navegacion.current?.querySelectorAll<HTMLElement>(
            'a[href], button:not(:disabled), [tabindex="0"]',
          );
          if (!elementos?.length) return;
          const primero = elementos[0],
            ultimo = elementos[elementos.length - 1];
          if (event.shiftKey && document.activeElement === primero) {
            event.preventDefault();
            ultimo.focus();
          }
          if (!event.shiftKey && document.activeElement === ultimo) {
            event.preventDefault();
            primero.focus();
          }
        }}
      >
        <div className="sidebar-marca">
          <Marca />
          <button
            className="boton icono cerrar-menu"
            aria-label="Cerrar navegación"
            onClick={() => {
              setMenu(false);
              requestAnimationFrame(() => abrir.current?.focus());
            }}
          >
            <X size={20} />
          </button>
        </div>
        <div className="empresa-contexto">
          <span className="empresa-icono">
            <Building2 size={20} aria-hidden="true" />
          </span>
          <div>
            <strong>{perfil.empresa?.nombre ?? "Administración global"}</strong>
            <span>Entorno Corporate</span>
          </div>
        </div>
        <nav aria-label="Navegación principal">
          <NavLink onClick={() => setMenu(false)} to="/administracion">
            <LayoutGrid size={19} aria-hidden="true" />
            Administración
          </NavLink>
          {tieneTodos(perfil, permisosMonitoreo) && (
            <NavLink onClick={() => setMenu(false)} to="/monitorear">
              <MapPin size={19} aria-hidden="true" />
              Monitorear
            </NavLink>
          )}
          {perfil.permisos.includes("repartidor.ver") && (
            <NavLink onClick={() => setMenu(false)} to="/almuerzos">
              <Utensils size={19} aria-hidden="true" />
              Almuerzos
            </NavLink>
          )}
          {puedeVerReportes(perfil) && (
            <>
              <p className="nav-etiqueta">Operación</p>
              <NavLink onClick={() => setMenu(false)} to="/resumenes">
                <BarChart3 size={19} aria-hidden="true" />
                Resúmenes diarios
              </NavLink>
            </>
          )}
          {(perfil.permisos.includes("empresa.ver") ||
            (perfil.permisos.includes("configuracion.administrar") &&
              perfil.roles.some((r) => r.tipo_alcance === "GLOBAL"))) && (
            <NavLink
              onClick={() => setMenu(false)}
              to={
                perfil.permisos.includes("empresa.ver")
                  ? "/limites-motoristas"
                  : "/limites-motoristas?alcance=RED"
              }
            >
              <Layers3 size={19} aria-hidden="true" />
              Límites de motoristas
            </NavLink>
          )}
          {modulosAdministrativos.some((m) =>
            tieneTodos(perfil, m.permisos),
          ) && <p className="nav-etiqueta siguientes">Administración</p>}
          {modulosAdministrativos.map((m, i) => {
            const Icono = iconos[i];
            return (
              tieneTodos(perfil, m.permisos) && (
                <NavLink
                  key={m.ruta}
                  onClick={() => setMenu(false)}
                  to={`/${m.ruta}`}
                >
                  <Icono size={19} aria-hidden="true" />
                  {m.nombre}
                </NavLink>
              )
            );
          })}
        </nav>
        <div className="sidebar-inferior">
          <div className="seguridad">
            <ShieldCheck size={19} aria-hidden="true" />
            <p>
              Administración protegida
              <small>Permisos verificados por el servidor</small>
            </p>
          </div>
          <div className="usuario-sidebar">
            <span className="avatar">
              {perfil.usuario.nombres.charAt(0)}
              {perfil.usuario.apellidos.charAt(0)}
            </span>
            <div>
              <strong>
                {perfil.usuario.nombres} {perfil.usuario.apellidos}
              </strong>
              <small>
                {perfil.roles.map((r) => r.nombre).join(", ") ||
                  "Sin roles asignados"}
              </small>
            </div>
          </div>
          <Link
            className="boton texto"
            to="/mi-cuenta"
            onClick={() => setMenu(false)}
          >
            Mi cuenta y contraseña
          </Link>
          <CerrarSesion />
        </div>
      </aside>
      <div className="app-principal" inert={menu}>
        <header className="barra-superior">
          <div>
            <button
              ref={abrir}
              className="boton icono abrir-menu"
              aria-label="Abrir navegación"
              aria-controls="navegacion-principal"
              aria-expanded={menu}
              onClick={() => setMenu(true)}
            >
              <Menu size={21} />
            </button>
            <Layers3 size={17} aria-hidden="true" />
            <span>Administración</span>
            <ChevronRight size={14} aria-hidden="true" />
            <strong>Corporate</strong>
          </div>
          <span className="entorno">
            <span className="punto" />
            Entorno independiente
          </span>
        </header>
        <main id="contenido" tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="app-pie">
          <span>VitaGo Corporate</span>
          <span>Administración de traslados</span>
        </footer>
      </div>
    </div>
  );
}
function ProteccionReportes() {
  const { perfil } = useAuth();
  return perfil && puedeVerReportes(perfil) ? (
    <Outlet />
  ) : (
    <>
      <div className="pagina-cabecera">
        <div>
          <span className="sobrelinea">REPORTES</span>
          <h1>Resúmenes diarios</h1>
        </div>
      </div>
      <Panel titulo="Permisos insuficientes">
        <Vacio
          titulo="No tienes acceso a estos reportes"
          texto="Este módulo requiere los permisos de motoristas, reportes, solicitudes, jornadas y evidencias. El administrador debe revisar también su alcance."
        />
      </Panel>
    </>
  );
}
function ModuloAnterior() {
  const { modulo } = useParams();
  const { perfil } = useAuth();
  const actual = modulosAdministrativos.find((m) => m.ruta === modulo);
  if (!actual || !perfil || !tieneTodos(perfil, actual.permisos))
    return <NoEncontrado />;
  return <Navigate to={`/${actual.ruta}`} replace />;
}
function ProteccionModulo({
  permisos,
  children,
}: {
  permisos: string[];
  children: ReactNode;
}) {
  const { perfil } = useAuth();
  return perfil && tieneTodos(perfil, permisos) ? (
    children
  ) : (
    <Panel titulo="Permisos insuficientes">
      <Vacio
        titulo="No tienes acceso a este módulo"
        texto="Solicita a un administrador que revise tus permisos y su alcance."
      />
    </Panel>
  );
}
function Inicio() {
  const { perfil } = useAuth();
  return (
    <Navigate to={perfil ? rutaInicial(perfil) : "/iniciar-sesion"} replace />
  );
}
function NoEncontrado() {
  return (
    <div className="estado">
      <h1>Página no disponible</h1>
      <p>La dirección no existe o no está disponible para tu cuenta.</p>
      <Link className="boton primario" to="/resumenes">
        Ir al panel
      </Link>
    </div>
  );
}
export function App() {
  const { cargando, error, recuperar, perfil } = useAuth();
  const espera = useEsperaReintento(error);
  if (cargando)
    return (
      <main className="pantalla-carga">
        <Marca />
        <Cargando texto="Recuperando sesión y permisos…" />
      </main>
    );
  if (error && api.tieneSesion() && !perfil)
    return (
      <main className="acceso-denegado">
        <Marca />
        <h1>No pudimos cargar tu perfil</h1>
        <p>
          La sesión está guardada, pero no se pudo consultar tu perfil y tus
          permisos. Puedes reintentar esa consulta sin volver a introducir la
          contraseña.
        </p>
        <ErrorVista error={error} />
        <button
          className="boton primario"
          disabled={espera > 0}
          onClick={() => void recuperar()}
        >
          Reintentar perfil
        </button>
        <button className="boton secundario" onClick={() => api.limpiar()}>
          Volver al inicio de sesión
        </button>
      </main>
    );
  return (
    <Routes>
      <Route path="/iniciar-sesion" element={<Login />} />
      <Route element={<Proteccion />}>
        <Route element={<Estructura />}>
          <Route path="/limites-motoristas" element={<LimitesMotoristas />} />
          <Route path="/administracion" element={<Administracion />} />
          <Route
            path="/almuerzos"
            element={
              <ProteccionModulo permisos={["repartidor.ver"]}>
                <Suspense fallback={<Cargando texto="Abriendo almuerzos…" />}>
                  <Almuerzos />
                </Suspense>
              </ProteccionModulo>
            }
          />
          <Route
            path="/monitorear"
            element={
              <ProteccionModulo permisos={permisosMonitoreo}>
                <Suspense fallback={<Cargando texto="Preparando monitoreo…" />}>
                  <Monitorear />
                </Suspense>
              </ProteccionModulo>
            }
          />
          <Route
            path="/solicitudes/nueva"
            element={
              <ProteccionModulo permisos={["solicitud.ver", "solicitud.crear"]}>
                <NuevaSolicitud />
              </ProteccionModulo>
            }
          />
          <Route
            path="/empresas"
            element={
              <ProteccionModulo permisos={["empresa.ver"]}>
                <Empresas />
              </ProteccionModulo>
            }
          />
          <Route
            path="/ubicaciones"
            element={
              <ProteccionModulo permisos={["ubicacion.ver"]}>
                <Ubicaciones />
              </ProteccionModulo>
            }
          />
          <Route
            path="/vehiculos"
            element={
              <ProteccionModulo permisos={["vehiculo.ver"]}>
                <Vehiculos />
              </ProteccionModulo>
            }
          />
          <Route element={<ProteccionReportes />}>
            <Route path="/resumenes" element={<Resumenes />} />
            <Route path="/motoristas/:id" element={<DetalleMotorista />} />
          </Route>
          <Route
            path="/solicitudes"
            element={
              <ProteccionModulo permisos={["solicitud.ver"]}>
                <Solicitudes />
              </ProteccionModulo>
            }
          />
          <Route
            path="/solicitudes/:id"
            element={
              <ProteccionModulo permisos={["solicitud.ver"]}>
                <DetalleSolicitud />
              </ProteccionModulo>
            }
          />
          <Route
            path="/motoristas"
            element={
              <ProteccionModulo permisos={["repartidor.ver"]}>
                <Motoristas />
              </ProteccionModulo>
            }
          />
          <Route
            path="/usuarios"
            element={
              <ProteccionModulo permisos={["usuario.ver"]}>
                <Usuarios />
              </ProteccionModulo>
            }
          />
          <Route
            path="/usuarios/nuevo"
            element={
              <ProteccionModulo
                permisos={["usuario.administrar", "rol.asignar"]}
              >
                <NuevoUsuario />
              </ProteccionModulo>
            }
          />
          <Route path="/mi-cuenta" element={<MiCuenta />} />
          <Route
            path="/usuarios/:id"
            element={
              <ProteccionModulo permisos={["usuario.ver"]}>
                <DetalleUsuario />
              </ProteccionModulo>
            }
          />
          <Route
            path="/sucursales"
            element={
              <ProteccionModulo permisos={["sucursal.ver"]}>
                <Sucursales />
              </ProteccionModulo>
            }
          />
          <Route
            path="/evidencias"
            element={
              <ProteccionModulo permisos={["solicitud.ver", "evidencia.ver"]}>
                <Evidencias />
              </ProteccionModulo>
            }
          />
          <Route path="/modulos/:modulo" element={<ModuloAnterior />} />
          <Route path="/" element={<Inicio />} />
          <Route path="*" element={<NoEncontrado />} />
        </Route>
      </Route>
    </Routes>
  );
}
