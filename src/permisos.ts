import type { Perfil } from "./contratos";
export const permisosReporte = [
  "repartidor.ver",
  "reporte.ver",
  "solicitud.ver",
  "jornada.ver",
  "evidencia.ver",
];
export const tieneTodos = (perfil: Perfil, permisos: string[]) =>
  permisos.every((p) => perfil.permisos.includes(p));
export const puedeVerReportes = (perfil: Perfil) =>
  tieneTodos(perfil, permisosReporte);
export const permisosMonitoreo = [
  "repartidor.ver",
  "solicitud.ver",
  "solicitud.ver_seguimiento",
];
// solicitud.ver es administrativo; los solicitantes y motoristas reciben ver_propias/ver_asignadas.
export const puedeEntrar = (perfil: Perfil) =>
  perfil.permisos.some((p) =>
    [
      "reporte.ver",
      "usuario.ver",
      "usuario.administrar",
      "rol.asignar",
      "sucursal.administrar",
      "repartidor.administrar",
      "solicitud.asignar",
      "solicitud.ver",
      "empresa.administrar",
      "ubicacion.aprobar",
      "vehiculo.administrar",
      "configuracion.administrar",
    ].includes(p),
  );
export const modulosAdministrativos = [
  {
    ruta: "solicitudes",
    nombre: "Solicitudes",
    permisos: ["solicitud.ver"],
    descripcion:
      "Solicitudes por sucursal o solicitante y trazabilidad de quién las creó.",
  },
  {
    ruta: "usuarios",
    nombre: "Usuarios y roles",
    permisos: ["usuario.ver"],
    descripcion: "Administración de usuarios y asignaciones de roles.",
  },
  {
    ruta: "sucursales",
    nombre: "Sucursales",
    permisos: ["sucursal.ver"],
    descripcion: "Administración de sucursales de la empresa.",
  },
  {
    ruta: "motoristas",
    nombre: "Motoristas",
    permisos: ["repartidor.ver"],
    descripcion:
      "Administración de motoristas y consulta de su cupo individual efectivo.",
  },
  {
    ruta: "evidencias",
    nombre: "Evidencias",
    permisos: ["solicitud.ver", "evidencia.ver"],
    descripcion: "Consulta detallada de evidencias por solicitud.",
  },
  {
    ruta: "empresas",
    nombre: "Empresas",
    permisos: ["empresa.ver"],
    descripcion: "Empresas y sus datos de contacto.",
  },
  {
    ruta: "ubicaciones",
    nombre: "Ubicaciones",
    permisos: ["ubicacion.ver"],
    descripcion: "Direcciones y autorizaciones de origen y destino.",
  },
  {
    ruta: "vehiculos",
    nombre: "Vehículos",
    permisos: ["vehiculo.ver"],
    descripcion: "Flota y registro de motocicletas.",
  },
];
export const rutaInicial = (perfil: Perfil) =>
  puedeVerReportes(perfil)
    ? "/resumenes"
    : `/${modulosAdministrativos.find((m) => tieneTodos(perfil, m.permisos))?.ruta ?? "administracion"}`;
