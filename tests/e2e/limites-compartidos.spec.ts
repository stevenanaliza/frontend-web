import { expect, test, type Page } from "@playwright/test";
import { perfil, tokens, motorista, lista, ejemplosSeccion } from "../fixtures";

const empresa = perfil.empresa.id;
const otra = "22222222-2222-4222-8222-222222222222";
const pais = ejemplosSeccion("### `GET /api/v1/organizaciones/empresas/`")[0]
  .resultados[0].pais;
const rutaRed = "/api/v1/organizaciones/configuracion/limites-motoristas/";
async function preparar(
  page: Page,
  {
    red = false,
    global = false,
    sucursal = false,
    errorGuardar = 0,
    inexistente = false,
  } = {},
) {
  const peticiones: { ruta: string; metodo: string; cuerpo: any }[] = [];
  const valores: Record<
    string,
    { limite_tubos: number; limite_frascos: number; limite_solicitudes: number }
  > = {
    [empresa]: { limite_tubos: 20, limite_frascos: 20, limite_solicitudes: 5 },
    [otra]: { limite_tubos: 40, limite_frascos: 40, limite_solicitudes: 4 },
    RED: { limite_tubos: 20, limite_frascos: 20, limite_solicitudes: 5 },
  };
  const paginar = (resultados: unknown[]) => ({
    conteo: resultados.length,
    pagina_siguiente: null,
    pagina_anterior: null,
    resultados,
  });
  const usuario = {
    ...perfil,
    empresa: global ? null : perfil.empresa,
    permisos: [
      ...perfil.permisos,
      "empresa.ver",
      "empresa.administrar",
      ...(red ? ["configuracion.administrar"] : []),
    ],
    roles: perfil.roles.map((r) => ({
      ...r,
      codigo: red && global ? "OPERADOR_RED" : r.codigo,
      tipo_alcance: global ? "GLOBAL" : sucursal ? "SUCURSAL" : "EMPRESA",
      empresa_id: global ? null : empresa,
      sucursal_id: sucursal ? "sucursal-prueba" : null,
    })),
  };
  await page.route("http://api.vitago.test/api/v1/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      ruta = url.pathname;
    let cuerpo: any = null;
    try {
      cuerpo = req.postDataJSON();
    } catch {}
    peticiones.push({ ruta, metodo: req.method(), cuerpo });
    const responder = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    if (ruta.endsWith("iniciar-sesion/")) return responder(tokens);
    if (ruta.endsWith("mi-perfil/")) return responder(usuario);
    if (ruta.endsWith("/repartidores/resumenes/")) return responder(lista);
    if (ruta.endsWith("/limites-motoristas/")) {
      if (inexistente) return responder({ detail: "No existe." }, 404);
      const id = ruta === rutaRed ? "RED" : ruta.split("/")[5];
      const clave = red ? "RED" : id;
      if (req.method() === "PATCH") {
        if (errorGuardar)
          return responder(
            {
              limite_solicitudes: [
                "El cupo no puede reducirse con la carga comprometida.",
              ],
            },
            errorGuardar,
          );
        valores[clave] = {
          limite_tubos: cuerpo.limite_tubos,
          limite_frascos: cuerpo.limite_frascos,
          limite_solicitudes: cuerpo.limite_solicitudes,
        };
      }
      return responder(
        red
          ? { alcance: "RED", ...valores.RED }
          : { alcance: "EMPRESA", empresa_id: id, ...valores[id] },
      );
    }
    if (ruta === "/api/v1/organizaciones/empresas/")
      return responder(
        paginar(
          [empresa, otra].map((id, i) => ({
            id,
            nombre: i ? "Otra empresa" : "Analiza",
            estado: "ACTIVO",
            razon_social: null,
            identificacion_fiscal: null,
            telefono: null,
            correo: null,
            pais,
            limites_motoristas: {
              alcance: red ? "RED" : "EMPRESA",
              ...valores[red ? "RED" : id],
            },
          })),
        ),
      );
    if (ruta === "/api/v1/repartidores/")
      return responder(
        paginar([{ ...motorista, ...valores[red ? "RED" : empresa] }]),
      );
    return responder({ detail: "Ruta no prevista." }, 404);
  });
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill("admin@example.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("solo-prueba");
  await page.getByRole("button", { name: "Entrar al panel" }).click();
  await page
    .getByRole("navigation", { name: "Navegación principal" })
    .waitFor();
  return { peticiones, valores };
}
test("Corporate configura una empresa, conserva otras y refresca los cupos consultados", async ({
  page,
}) => {
  const { peticiones, valores } = await preparar(page);
  await page.goto("/limites-motoristas");
  await page
    .getByRole("button", { name: "Editar límites compartidos" })
    .click();
  await page.getByLabel("Límite de tubos por motorista").fill("25");
  await page.getByLabel("Límite de frascos por motorista").fill("12");
  await page.getByLabel("Límite de solicitudes por motorista").fill("3");
  await page
    .getByRole("button", { name: "Guardar límites", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Límites actualizados" }),
  ).toContainText("25 tubos, 12 frascos y 3 solicitudes activas por motorista");
  expect(
    peticiones.some((p) => p.ruta === "/api/v1/organizaciones/empresas/"),
  ).toBe(false);
  expect(valores[otra]).toEqual({
    limite_tubos: 40,
    limite_frascos: 40,
    limite_solicitudes: 4,
  });
  await page.goto("/motoristas");
  await expect(page.getByRole("table")).toContainText("25 tubos");
  await expect(
    page.getByRole("button", { name: "Configurar límite", exact: true }),
  ).toHaveCount(0);
  expect(
    peticiones.filter((p) => p.metodo === "PATCH").map((p) => p.ruta),
  ).toEqual([`/api/v1/organizaciones/empresas/${empresa}/limites-motoristas/`]);
});
test("un alcance de sucursal consulta pero no edita la configuración de empresa", async ({
  page,
}) => {
  const { peticiones } = await preparar(page, { sucursal: true });
  await page.goto("/limites-motoristas");
  await expect(
    page.getByRole("heading", {
      name: "Configuración de la empresa",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Editar límites compartidos" }),
  ).toHaveCount(0);
  expect(peticiones.some((p) => p.metodo === "PATCH")).toBe(false);
});
test("Network usa una única configuración general y exige permiso global para editar", async ({
  page,
}) => {
  const { peticiones } = await preparar(page, { red: true, global: true });
  await page.goto("/limites-motoristas?alcance=RED");
  await page
    .getByRole("button", { name: "Editar límites compartidos" })
    .click();
  await page.getByLabel("Límite de tubos por motorista").fill("28");
  await page
    .getByRole("button", { name: "Guardar límites", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Límites actualizados" }),
  ).toContainText("28 tubos");
  expect(
    peticiones.filter((p) => p.metodo === "PATCH").map((p) => p.ruta),
  ).toEqual([rutaRed]);
});
test("el administrador de cliente Network ve la red sin PATCH de empresa ni de red", async ({
  page,
}) => {
  const { peticiones } = await preparar(page, { red: true });
  await page.goto("/limites-motoristas");
  await expect(
    page.getByRole("heading", {
      name: "Configuración general de la red",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Editar límites compartidos" }),
  ).toHaveCount(0);
  expect(peticiones.some((p) => p.ruta === rutaRed && p.metodo === "GET")).toBe(
    true,
  );
  expect(peticiones.some((p) => p.metodo === "PATCH")).toBe(false);
});
for (const status of [403, 409])
  test(`HTTP ${status} conserva campos y no repite la escritura`, async ({
    page,
  }) => {
    const { peticiones } = await preparar(page, { errorGuardar: status });
    await page.goto("/limites-motoristas");
    await page
      .getByRole("button", { name: "Editar límites compartidos" })
      .click();
    await page.getByLabel("Límite de solicitudes por motorista").fill("2");
    await page
      .getByRole("button", { name: "Guardar límites", exact: true })
      .click();
    await expect(page.locator("#limite_solicitudes-error")).toContainText(
      "carga comprometida",
    );
    await expect(
      page.getByLabel("Límite de solicitudes por motorista"),
    ).toHaveValue("2");
    expect(peticiones.filter((p) => p.metodo === "PATCH")).toHaveLength(1);
  });
test("configuración aún no desplegada muestra un estado explícito sin volver al PATCH individual", async ({
  page,
}) => {
  const { peticiones } = await preparar(page, { inexistente: true });
  await page.goto("/limites-motoristas");
  await expect(
    page.getByRole("heading", {
      name: "No se encontró la configuración de límites",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Guardar límites", exact: true }),
  ).toHaveCount(0);
  expect(peticiones.some((p) => p.metodo === "PATCH")).toBe(false);
});
test("muestra cupos individuales y formulario en escritorio, tablet y teléfono", async ({
  page,
}) => {
  await preparar(page);
  await page.goto("/limites-motoristas");
  await page
    .getByRole("button", { name: "Editar límites compartidos" })
    .click();
  for (const width of [1440, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.screenshot({
      path: `artifacts/limites-compartidos-${width}.png`,
      fullPage: true,
    });
  }
});
