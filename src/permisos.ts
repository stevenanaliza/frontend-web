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
    nombre: "Motoristas y límites",
    permisos: ["repartidor.ver"],
    descripcion:
      "Administración de motoristas y configuración del límite de tubos.",
  },
  {
    ruta: "evidencias",
    nombre: "Evidencias",
    permisos: ["solicitud.ver", "evidencia.ver"],
    descripcion: "Consulta detallada de evidencias por solicitud.",
  },
];
export const rutaInicial = (perfil: Perfil) =>
  puedeVerReportes(perfil)
    ? "/resumenes"
    : `/${modulosAdministrativos.find((m) => tieneTodos(perfil, m.permisos))?.ruta ?? "resumenes"}`;
