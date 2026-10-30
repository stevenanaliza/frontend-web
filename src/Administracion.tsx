import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAuth } from "./auth";
import { Cabecera } from "./admin-comunes";
import { tieneTodos, permisosMonitoreo, puedeElegirEmpresa } from "./permisos";

const acciones = [
  {
    nombre: "Revisar almuerzos",
    ruta: "/almuerzos?en_almuerzo=true",
    permisos: ["repartidor.ver"],
    texto: "Motoristas en almuerzo y hora de inicio reportada.",
  },
  {
    nombre: "Monitorear",
    ruta: "/monitorear",
    permisos: permisosMonitoreo,
    texto:
      "Ubicación reportada, solicitudes y carga de tubos y frascos de los motoristas.",
  },
  {
    nombre: "Crear solicitud",
    ruta: "/solicitudes/nueva",
    permisos: ["solicitud.crear", "solicitud.ver"],
    texto: "Traslados, tubos, frascos, prioridad y destino.",
  },
  {
    nombre: "Crear usuario",
    ruta: "/usuarios/nuevo",
    permisos: ["usuario.administrar", "rol.asignar"],
    texto: "Cuenta, contraseña temporal y primer rol autorizado.",
  },
  {
    nombre: "Crear sucursal",
    ruta: "/sucursales?crear=1",
    permisos: ["sucursal.ver", "sucursal.administrar"],
    texto: "Registra una sede en una ubicación aprobada.",
  },
  {
    nombre: "Crear ubicación",
    ruta: "/ubicaciones?crear=1",
    permisos: ["ubicacion.ver", "ubicacion.crear"],
    texto: "Dirección, coordenadas y uso como origen o destino.",
  },
  {
    nombre: "Registrar motocicleta",
    ruta: "/vehiculos?crear=1",
    permisos: ["vehiculo.ver", "vehiculo.administrar"],
    texto: "Añade una motocicleta a la flota de tu empresa.",
  },
  {
    nombre: "Crear motorista",
    ruta: "/motoristas?crear=1",
    permisos: ["repartidor.ver", "repartidor.administrar"],
    texto: "Vincula un usuario con rol de motorista a su perfil operativo.",
  },
  {
    nombre: "Gestionar usuarios y roles",
    ruta: "/usuarios",
    permisos: ["usuario.ver"],
    texto: "Datos de cuenta, permisos, roles y contraseñas.",
  },
  {
    nombre: "Consultar empresas",
    ruta: "/empresas",
    permisos: ["empresa.ver"],
    texto: "Datos de organizaciones y acceso a sus sedes y flotas.",
  },
  {
    nombre: "Límites de motoristas",
    ruta: "/limites-motoristas",
    permisos: ["empresa.ver"],
    texto:
      "Configuración compartida de tubos, frascos y solicitudes, con cupo individual por motorista.",
  },
  {
    nombre: "Gestionar ubicaciones",
    ruta: "/ubicaciones",
    permisos: ["ubicacion.ver"],
    texto: "Consulta direcciones y revisa sus autorizaciones.",
  },
];
export function Administracion() {
  const { perfil } = useAuth();
  if (!perfil) return null;
  return (
    <>
      <Cabecera
        titulo="Administración"
        texto="Crea y gestiona los registros de VitaGo dentro de tu alcance autorizado."
      />
      <div className="acciones-admin">
        {puedeElegirEmpresa(perfil) &&
          !perfil.permisos.includes("empresa.ver") &&
          perfil.permisos.includes("configuracion.administrar") &&
          perfil.roles.some((r) => r.tipo_alcance === "GLOBAL") && (
            <Link
              className="panel acceso-admin"
              to="/limites-motoristas?alcance=RED"
            >
              <div>
                <h2>Límites generales de Network</h2>
                <p>
                  Configura el cupo individual de todos los motoristas de la
                  red.
                </p>
              </div>
              <ArrowRight size={20} aria-hidden="true" />
            </Link>
          )}
        {acciones
          .filter((a) => tieneTodos(perfil, a.permisos))
          .map((a) => (
            <Link key={a.nombre} className="panel acceso-admin" to={a.ruta}>
              <div>
                <h2>{a.nombre}</h2>
                <p>{a.texto}</p>
              </div>
              <ArrowRight size={20} aria-hidden="true" />
            </Link>
          ))}
      </div>
    </>
  );
}
