import { readFileSync } from "node:fs";
// Datos ilustrativos extraídos del contrato oficial, exclusivamente para pruebas.
const contrato = readFileSync(
  new URL("../VITAGO_API_FRONTEND.md", import.meta.url),
  "utf8",
);
const seccion = contrato.slice(
  contrato.indexOf("## Resúmenes administrativos por motorista (0.40.0"),
);
const ejemplos = [...seccion.matchAll(/```json\s+([\s\S]*?)```/g)].map(
  (match) => JSON.parse(match[1]),
);
export const lista = ejemplos[0];
export const resumen = lista.resultados[0];
export const lecturas = ejemplos[1];
export function ejemplosSeccion(titulo: string) {
  const inicio = contrato.indexOf(titulo);
  if (inicio < 0) throw Error(`Sección de contrato no encontrada: ${titulo}`);
  return [...contrato.slice(inicio).matchAll(/```json\s+([\s\S]*?)```/g)].map(
    (match) => JSON.parse(match[1]),
  );
}
const agrupaciones = ejemplosSeccion(
  "### `GET /api/v1/solicitudes/agrupaciones/`",
);
export const gruposSucursal = agrupaciones[0];
export const gruposSolicitante = agrupaciones[1];
const solicitudDocumento = ejemplosSeccion(
  "### `GET /api/v1/solicitudes/{solicitud_id}/`",
)[0];
export const solicitud = {
  ...solicitudDocumento,
  // Los ejemplos de secciones distintas usan UUID de empresas diferentes.
  // Esta sesión Corporate de prueba debe tener una sola empresa coherente.
  empresa_id: resumen.repartidor.empresa_id,
  cantidad_tubos: null,
  cantidad_frascos: null,
};
export const usuario = ejemplosSeccion("### `GET /api/v1/usuarios/`")[0];
export const historialRoles = ejemplosSeccion(
  "### `GET /api/v1/usuarios/{usuario_id}/roles/`",
)[0];
export const sucursal = ejemplosSeccion(
  "### `GET /api/v1/organizaciones/empresas/{empresa_id}/sucursales/`",
)[0];
const motoristaDocumento = ejemplosSeccion("### Motoristas")[2].resultados[0];
export const motorista = {
  ...motoristaDocumento,
  empresa_id: resumen.repartidor.empresa_id,
  ...resumen.carga_actual,
  limite_frascos: 20,
  frascos_comprometidos: 9,
  frascos_en_transporte: 4,
  frascos_reservados: 5,
  frascos_disponibles: 11,
  solicitudes_sin_cantidad_frascos: 0,
};
const evidenciaDocumento = ejemplosSeccion("### Registrar evidencia")[0];
export const evidencia = {
  ...evidenciaDocumento,
  temperatura_contenedor_c: null,
  fuente_temperatura: null,
};
export const tokens = {
  token_acceso: "acceso-prueba",
  token_refresco: "refresco-prueba",
  expira_token_acceso_en: "2099-01-01T00:00:00Z",
  expira_token_refresco_en: "2099-02-01T00:00:00Z",
  sesion_id: "sesion-prueba",
};
export const perfil = {
  usuario: {
    id: "usuario-prueba",
    correo: "admin@example.test",
    nombres: "Administradora",
    apellidos: "De prueba",
    estado: "ACTIVO",
  },
  empresa: { id: resumen.repartidor.empresa_id, nombre: "Analiza" },
  sucursal: null,
  roles: [
    {
      codigo: "ADMINISTRADOR_CORPORATIVO",
      nombre: "Administración de prueba",
      tipo_alcance: "EMPRESA" as const,
      empresa_id: resumen.repartidor.empresa_id,
      sucursal_id: null,
    },
  ],
  permisos: [
    "repartidor.ver",
    "reporte.ver",
    "solicitud.ver",
    "jornada.ver",
    "evidencia.ver",
    "usuario.ver",
    "repartidor.administrar",
    "solicitud.asignar",
    "sucursal.administrar",
    "sucursal.ver",
  ],
};
