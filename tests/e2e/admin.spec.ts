import { expect, test, type Page } from "@playwright/test";
import {
  evidencia,
  gruposSolicitante,
  gruposSucursal,
  historialRoles,
  lista,
  motorista,
  perfil,
  solicitud,
  sucursal,
  tokens,
  usuario,
} from "../fixtures";

async function backendAdmin(
  page: Page,
  opciones: {
    sinEditarLimite?: boolean;
    errorLimite?: boolean;
    soloSolicitudes?: boolean;
  } = {},
) {
  const peticiones: { url: URL; metodo: string; cuerpo: unknown }[] = [];
  let estadoMotorista = structuredClone(motorista);
  let estadoUsuario = structuredClone(usuario);
  const perfilAdmin = {
    ...perfil,
    permisos: opciones.soloSolicitudes
      ? ["solicitud.ver"]
      : [
          ...perfil.permisos,
          "usuario.administrar",
          "empresa.ver",
          "empresa.administrar",
        ],
  };
  if (opciones.sinEditarLimite)
    perfilAdmin.permisos = perfilAdmin.permisos.filter(
      (p) => p !== "empresa.administrar",
    );
  const pagina = (resultados: unknown[]) => ({
    conteo: resultados.length,
    pagina_siguiente: null,
    pagina_anterior: null,
    resultados,
  });
  await page.route("http://api.vitago.test/api/v1/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    let cuerpo: unknown;
    try {
      cuerpo = req.postDataJSON();
    } catch {
      cuerpo = null;
    }
    peticiones.push({ url, metodo: req.method(), cuerpo });
    const responder = (datos: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(datos),
      });
    const ruta = url.pathname;
    if (ruta.endsWith("iniciar-sesion/")) return responder(tokens);
    if (ruta.endsWith("mi-perfil/")) return responder(perfilAdmin);
    if (ruta.endsWith("/repartidores/resumenes/")) return responder(lista);
    if (ruta.endsWith("/solicitudes/agrupaciones/"))
      return responder(
        url.searchParams.get("por") === "solicitante"
          ? gruposSolicitante
          : {
              ...gruposSucursal,
              conteo: 3,
              resultados: [
                ...gruposSucursal.resultados,
                {
                  ...gruposSucursal.resultados[0],
                  sucursal_id: null,
                  sucursal_nombre: null,
                  total: 1,
                },
              ],
            },
      );
    if (ruta === "/api/v1/solicitudes/")
      return responder({
        ...pagina([solicitud]),
        conteo: 21,
        pagina_siguiente:
          url.searchParams.get("pagina") === "2"
            ? null
            : "http://api.vitago.test/api/v1/solicitudes/?pagina=2",
        pagina_anterior:
          url.searchParams.get("pagina") === "2"
            ? "http://api.vitago.test/api/v1/solicitudes/"
            : null,
      });
    if (ruta.endsWith("/archivo/"))
      return route.fulfill({
        status: 200,
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lS0AAAAASUVORK5CYII=",
          "base64",
        ),
      });
    if (ruta.endsWith("/evidencias/")) return responder(pagina([evidencia]));
    if (ruta === `/api/v1/solicitudes/${solicitud.id}/`)
      return responder(solicitud);
    if (ruta === "/api/v1/repartidores/")
      return responder(pagina([estadoMotorista]));
    if (
      ruta ===
      `/api/v1/organizaciones/empresas/${perfil.empresa.id}/limites-motoristas/`
    ) {
      if (opciones.errorLimite && req.method() === "PATCH")
        return responder(
          {
            limite_tubos: [
              "El límite no puede ser menor que los tubos comprometidos.",
            ],
          },
          400,
        );
      if (req.method() === "PATCH")
        estadoMotorista = {
          ...estadoMotorista,
          limite_tubos: (cuerpo as { limite_tubos: number }).limite_tubos,
          limite_solicitudes: (cuerpo as { limite_solicitudes: number })
            .limite_solicitudes,
        };
      return responder({
        empresa_id: perfil.empresa.id,
        alcance: "EMPRESA",
        limite_tubos: estadoMotorista.limite_tubos,
        limite_solicitudes: estadoMotorista.limite_solicitudes,
      });
    }
    if (ruta === "/api/v1/usuarios/") return responder(pagina([estadoUsuario]));
    if (ruta === `/api/v1/usuarios/${usuario.id}/roles/`)
      return responder(historialRoles);
    if (ruta === `/api/v1/usuarios/${usuario.id}/`) {
      if (req.method() === "PATCH")
        estadoUsuario = { ...estadoUsuario, ...(cuerpo as object) };
      return responder(estadoUsuario);
    }
    if (
      ruta.includes("/organizaciones/empresas/") &&
      ruta.endsWith("/sucursales/")
    )
      return responder(pagina([sucursal]));
    return responder({ detail: "Ruta no prevista por la prueba." }, 404);
  });
  return peticiones;
}
async function entrar(page: Page) {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill("admin@example.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("solo-prueba");
  await page.getByRole("button", { name: "Entrar al panel" }).click();
}
test("solicitudes por sucursal, sin sucursal, solicitante y paginación remota", async ({
  page,
}) => {
  const peticiones = await backendAdmin(page);
  await entrar(page);
  await page.getByRole("link", { name: "Solicitudes", exact: true }).click();
  await page
    .getByRole("row")
    .filter({
      has: page.getByRole("cell", { name: "Sin sucursal", exact: true }),
    })
    .getByRole("button", { name: "Ver solicitudes" })
    .click();
  await expect(
    page.getByRole("region", { name: "Solicitudes del grupo" }),
  ).toContainText("Ana López");
  expect(
    peticiones.some(
      (p) =>
        p.url.pathname === "/api/v1/solicitudes/" &&
        p.url.searchParams.get("sin_sucursal") === "true" &&
        !p.url.searchParams.has("sucursal_id"),
    ),
  ).toBe(true);
  await page
    .getByRole("region", { name: "Solicitudes del grupo" })
    .getByRole("button", { name: "Siguiente", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Solicitudes del grupo" }),
  ).toContainText("Página 2");
  expect(
    peticiones.some(
      (p) =>
        p.url.pathname === "/api/v1/solicitudes/" &&
        p.url.searchParams.get("pagina") === "2",
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Por solicitante", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ver solicitudes", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Solicitudes del grupo" }),
  ).toContainText("Sin declarar");
  expect(
    peticiones.some(
      (p) =>
        p.url.searchParams.get("solicitada_por_id") ===
          solicitud.solicitada_por_id &&
        p.url.searchParams.get("empresa_id") === solicitud.empresa_id,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "Ver detalle", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: solicitud.numero, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Información de la solicitud" }),
  ).toContainText("Ana López");
});
test("muestra evidencia privada y libera la imagen al cerrar", async ({
  page,
}) => {
  const peticiones = await backendAdmin(page);
  await entrar(page);
  await page.goto(`/solicitudes/${solicitud.id}`);
  await page.getByRole("button", { name: "Ver imagen", exact: true }).click();
  const img = page.getByRole("img", {
    name: /Foto de recolección de la solicitud/,
  });
  await expect(img).toBeVisible();
  await expect(img).toHaveAttribute("src", /^blob:/);
  await page.getByRole("button", { name: "Cerrar imagen" }).click();
  await expect(img).toHaveCount(0);
  expect(
    peticiones.filter((p) => p.url.pathname.endsWith("/archivo/")),
  ).toHaveLength(1);
});
test("guarda el límite con motivo una sola vez y muestra la respuesta", async ({
  page,
}) => {
  const peticiones = await backendAdmin(page);
  await entrar(page);
  await page
    .getByRole("link", { name: "Límites de motoristas", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Editar límites compartidos" })
    .click();
  await page.getByLabel("Límite de tubos por motorista").fill("30");
  await page.getByLabel("Motivo del cambio").fill("Contenedor aprobado");
  await page
    .getByRole("button", { name: "Guardar límites", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Límites actualizados" }),
  ).toContainText("30 tubos y 5 solicitudes activas por motorista");
  const cambios = peticiones.filter((p) => p.metodo === "PATCH");
  expect(cambios).toHaveLength(1);
  expect(cambios[0].cuerpo).toEqual({
    limite_tubos: 30,
    limite_solicitudes: 5,
    motivo: "Contenedor aprobado",
  });
});
test("conserva valores y errores por campo del límite sin reintentar", async ({
  page,
}) => {
  const peticiones = await backendAdmin(page, { errorLimite: true });
  await entrar(page);
  await page.goto("/limites-motoristas");
  await page
    .getByRole("button", { name: "Editar límites compartidos" })
    .click();
  await page.getByLabel("Límite de tubos por motorista").fill("1");
  await page.getByLabel("Motivo del cambio").fill("Revisión de cupo");
  await page
    .getByRole("button", { name: "Guardar límites", exact: true })
    .click();
  await expect(page.locator("#limite_tubos-error")).toContainText(
    "tubos comprometidos",
  );
  await expect(page.getByLabel("Límite de tubos por motorista")).toHaveValue(
    "1",
  );
  await expect(page.getByLabel("Motivo del cambio")).toHaveValue(
    "Revisión de cupo",
  );
  expect(peticiones.filter((p) => p.metodo === "PATCH")).toHaveLength(1);
});
test("sin administrar permite consultar motoristas y oculta la edición", async ({
  page,
}) => {
  const peticiones = await backendAdmin(page, { sinEditarLimite: true });
  await entrar(page);
  await page.goto("/motoristas");
  await expect(
    page.getByRole("heading", { name: "Directorio de motoristas" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Configurar límite" }),
  ).toHaveCount(0);
  expect(peticiones.some((p) => p.metodo === "PATCH")).toBe(false);
});
test("usuarios, historial de roles, edición permitida y sucursales", async ({
  page,
}) => {
  const peticiones = await backendAdmin(page);
  await entrar(page);
  await page.getByRole("link", { name: "Usuarios y roles" }).click();
  await page.getByRole("link", { name: "Ver usuario" }).click();
  await expect(
    page.getByRole("region", { name: "Historial de roles" }),
  ).toContainText("Vigente");
  await page.getByRole("button", { name: "Editar usuario" }).click();
  await page.getByLabel("Nombres", { exact: true }).fill("Nombre corregido");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Cambios del usuario guardados" }),
  ).toContainText("Cambios del usuario guardados");
  expect(peticiones.filter((p) => p.metodo === "PATCH")).toHaveLength(1);
  await page.getByRole("link", { name: "Sucursales", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Directorio de sucursales" }),
  ).toContainText("SPS-01");
});
test("un administrador de solo solicitudes llega a su módulo y no consulta reportes", async ({
  page,
}) => {
  const peticiones = await backendAdmin(page, { soloSolicitudes: true });
  await entrar(page);
  await expect(page).toHaveURL(/\/solicitudes$/);
  await expect(
    page.getByRole("heading", { name: "Sucursales con solicitudes" }),
  ).toBeVisible();
  await page.goto("/usuarios");
  await expect(
    page.getByRole("heading", { name: "No tienes acceso a este módulo" }),
  ).toBeVisible();
  expect(
    peticiones.some(
      (p) =>
        p.url.pathname.endsWith("/usuarios/") ||
        p.url.pathname.endsWith("/resumenes/"),
    ),
  ).toBe(false);
});
test("capturas de nuevos módulos en escritorio y tablet sin desbordar", async ({
  page,
}) => {
  await backendAdmin(page);
  await entrar(page);
  for (const ruta of ["solicitudes", "motoristas", "usuarios", "sucursales"]) {
    await page.goto(`/${ruta}`);
    await expect(page.getByRole("table")).toBeVisible();
    await page.screenshot({
      path: `artifacts/${ruta}-fase2-escritorio.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.screenshot({
      path: `artifacts/${ruta}-fase2-tablet.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
});
