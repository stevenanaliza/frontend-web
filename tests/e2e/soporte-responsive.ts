import { expect, type Page } from "@playwright/test";
import {
  evidencia,
  ejemplosSeccion,
  gruposSucursal,
  gruposSolicitante,
  historialRoles,
  lecturas,
  lista,
  motorista,
  perfil,
  resumen,
  solicitud,
  sucursal,
  tokens,
  usuario,
} from "../fixtures";

const empresa = perfil.empresa.id;
const nombreLargo =
  "Administración regional de laboratorios y transporte de muestras de la zona norte";
const empresaDatos = {
  ...ejemplosSeccion("### `GET /api/v1/organizaciones/empresas/`")[0]
    .resultados[0],
  id: empresa,
  nombre: nombreLargo,
};
const opciones = ejemplosSeccion(
  "### `GET /api/v1/solicitudes/opciones-creacion/`",
)[0];
const tipos = ejemplosSeccion(
  "### `GET /api/v1/solicitudes/tipos-servicio/`",
)[0];
const permisos = [
  ...perfil.permisos,
  "empresa.ver",
  "empresa.administrar",
  "usuario.administrar",
  "rol.asignar",
  "ubicacion.ver",
  "ubicacion.crear",
  "ubicacion.aprobar",
  "vehiculo.ver",
  "vehiculo.administrar",
  "solicitud.crear",
  "solicitud.reasignar",
  "solicitud.cancelar",
];
const perfilPrueba = {
  ...perfil,
  empresa: { ...perfil.empresa, nombre: nombreLargo },
  usuario: {
    ...perfil.usuario,
    nombres: "María Fernanda",
    apellidos: "Administradora de Operaciones Regionales",
    correo: "administracion.regional.de.laboratorios.y.transporte@example.test",
  },
  permisos,
};
const usuarioPrueba = {
  ...usuario,
  nombres: "María Fernanda",
  apellidos: "Administradora de Operaciones Regionales",
  correo: perfilPrueba.usuario.correo,
};
const tipoUbicacion = {
  id: "11111111-1111-4111-8111-111111111111",
  codigo: "SUCURSAL",
  nombre: "Sucursal de atención y distribución de muestras",
};
const moto = {
  ...motorista.vehiculo,
  empresa_id: empresa,
  marca: "Motocicleta de transporte",
  modelo: "Modelo operativo",
  anio: 2026,
};
const usuarioMotorista = {
  ...usuarioPrueba,
  empresa_id: empresa,
  roles: [
    {
      codigo: "REPARTIDOR_CORPORATIVO",
      nombre: "Motorista corporativo",
      tipo_alcance: "EMPRESA",
      empresa_id: empresa,
      sucursal_id: null,
    },
  ],
};
export const rutaMotorista = `/motoristas/${resumen.repartidor.id}`;
export const rutaUsuario = `/usuarios/${usuario.id}`;
export const rutaSolicitud = `/solicitudes/${solicitud.id}`;
export async function prepararResponsive(page: Page) {
  const inesperadas: string[] = [];
  const pagina = (items: unknown[]) => ({
    conteo: 21,
    pagina_siguiente: "http://api.vitago.test/api/v1/prueba/?pagina=2",
    pagina_anterior: null,
    resultados: items,
  });
  await page.route("http://api.vitago.test/api/v1/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      ruta = url.pathname;
    const responder = (datos: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(datos),
      });
    if (ruta.endsWith("iniciar-sesion/")) return responder(tokens);
    if (ruta.endsWith("mi-perfil/")) return responder(perfilPrueba);
    if (ruta.endsWith("cerrar-sesion/")) return route.fulfill({ status: 204 });
    if (ruta.endsWith("/repartidores/resumenes/")) return responder(lista);
    if (ruta.endsWith("/resumen/")) return responder(resumen);
    if (ruta.endsWith("/temperaturas/")) return responder(lecturas);
    if (ruta.endsWith("/limites-motoristas/"))
      return responder({
        alcance: "EMPRESA",
        empresa_id: empresa,
        limite_tubos: 20,
        limite_solicitudes: 5,
      });
    if (ruta === "/api/v1/organizaciones/empresas/")
      return responder(pagina([empresaDatos]));
    if (ruta === `/api/v1/organizaciones/empresas/${empresa}/`)
      return responder(empresaDatos);
    if (ruta.includes("/sucursales/"))
      return responder(pagina([{ ...sucursal, nombre: nombreLargo }]));
    if (ruta.endsWith("/ubicaciones/tipos/"))
      return responder({ resultados: [tipoUbicacion] });
    if (ruta === "/api/v1/ubicaciones/")
      return responder(
        pagina([
          {
            id: "22222222-2222-4222-8222-222222222222",
            empresa_id: empresa,
            estado: "APROBADO",
            permite_origen: true,
            permite_destino: true,
            ubicacion: {
              ...sucursal.ubicacion,
              nombre: nombreLargo,
              estado: "ACTIVO",
              tipo_ubicacion: tipoUbicacion,
              pais: empresaDatos.pais,
              departamento: "Francisco Morazán",
              municipio: "Distrito Central",
              ciudad: "Tegucigalpa",
              colonia: null,
              telefono: null,
              nombre_contacto: perfilPrueba.usuario.nombres,
              instrucciones: null,
            },
          },
        ]),
      );
    if (ruta === "/api/v1/usuarios/roles-asignables/")
      return responder({
        resultados: [
          {
            codigo: "SOLICITANTE_CORPORATIVO",
            nombre: "Solicitante corporativo de sucursal",
            descripcion: "Rol de prueba",
            permite_alcance_global: false,
            permite_alcance_empresa: true,
            permite_alcance_sucursal: true,
          },
        ],
      });
    if (ruta === "/api/v1/usuarios/")
      return responder(pagina([usuarioMotorista]));
    if (ruta.endsWith("/roles/")) return responder(historialRoles);
    if (ruta === `/api/v1/usuarios/${usuario.id}/`)
      return responder(usuarioPrueba);
    if (ruta === "/api/v1/vehiculos/") return responder(pagina([moto]));
    if (
      ruta === "/api/v1/repartidores/" ||
      ruta.endsWith("/repartidores/disponibles/")
    )
      return responder(
        pagina([
          {
            ...motorista,
            usuario: {
              ...motorista.usuario,
              nombres: "María Fernanda",
              apellidos: "Administradora de Operaciones Regionales",
            },
          },
        ]),
      );
    if (ruta.endsWith("/solicitudes/opciones-creacion/"))
      return responder({
        ...opciones,
        empresa_id: empresa,
        modalidad_seleccionada: url.searchParams.get("modalidad"),
        destinos: url.searchParams.get("origen_id") ? opciones.destinos : [],
      });
    if (ruta.endsWith("/tipos-servicio/")) return responder(tipos);
    if (ruta.endsWith("/solicitudes/agrupaciones/"))
      return responder(
        url.searchParams.get("por") === "solicitante"
          ? gruposSolicitante
          : gruposSucursal,
      );
    if (ruta === "/api/v1/solicitudes/") return responder(pagina([solicitud]));
    if (ruta === `/api/v1/solicitudes/${solicitud.id}/`)
      return responder({
        ...solicitud,
        cantidad_tubos: 3,
        estado: "PENDING",
        repartidor_asignado_id: null,
      });
    if (ruta.endsWith("/evidencias/")) return responder(pagina([evidencia]));
    if (ruta.endsWith("/archivo/"))
      return route.fulfill({
        status: 200,
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lS0AAAAASUVORK5CYII=",
          "base64",
        ),
      });
    inesperadas.push(`${req.method()} ${ruta}`);
    return responder(
      { detail: "Ruta no prevista para la revisión responsive." },
      404,
    );
  });
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill("admin@example.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("solo-prueba");
  await page.getByRole("button", { name: "Entrar al panel" }).click();
  await expect(
    page.getByRole("heading", { name: "Resúmenes diarios", exact: true }),
  ).toBeVisible();
  return inesperadas;
}
export async function cargarPantalla(page: Page, ruta: string) {
  await page.goto(ruta);
  await page.getByRole("heading", { level: 1 }).waitFor();
  await expect(page.locator(".girar")).toHaveCount(0);
  if (ruta === "/limites-motoristas")
    await page
      .getByRole("button", { name: "Editar límites compartidos" })
      .click();
  if (ruta === "/solicitudes/nueva") {
    await page
      .getByRole("combobox", { name: "Modalidad", exact: true })
      .selectOption("ENTRE_SUCURSALES");
    await page
      .getByLabel("Sucursal de origen")
      .selectOption(opciones.origenes[0].ubicacion.id);
    await page
      .getByRole("combobox", { name: "Destino", exact: true })
      .selectOption(opciones.destinos[0].ubicacion.id);
  }
  await expect(page.locator(".girar")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
}
