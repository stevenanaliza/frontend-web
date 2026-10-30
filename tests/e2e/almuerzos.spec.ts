import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { motorista, perfil } from "../fixtures";
import { simularGoogleMaps } from "./mapa-doble";
import { prepararMonitoreo } from "./soporte-monitoreo";

const inicio = "2026-10-29T12:00:00-06:00";
const almorzando = {
  ...motorista,
  estado_operativo: "PAUSED",
  en_almuerzo: true,
  almuerzo_iniciado_en: inicio,
};
const pausa = {
  ...motorista,
  id: "11111111-1111-4111-8111-111111111111",
  usuario: { ...motorista.usuario, nombres: "Pausa", apellidos: "General" },
  estado_operativo: "PAUSED",
  en_almuerzo: false,
  almuerzo_iniciado_en: null,
};
const anterior = {
  ...motorista,
  id: "22222222-2222-4222-8222-222222222222",
  usuario: { ...motorista.usuario, nombres: "Versión", apellidos: "Anterior" },
  estado_operativo: "PAUSED",
};

async function preparar(page: Page, antiguo = false) {
  const todas: { metodo: string; ruta: string }[] = [];
  page.on("request", (req) => {
    if (req.url().startsWith("http://api.vitago.test/"))
      todas.push({ metodo: req.method(), ruta: new URL(req.url()).pathname });
  });
  await simularGoogleMaps(page);
  await prepararMonitoreo(page);
  const consultas: URL[] = [];
  const control = { termino: false };
  const pagina = (resultados: unknown[]) => ({
    conteo: resultados.length,
    pagina_siguiente: null,
    pagina_anterior: null,
    resultados,
  });
  await page.route(
    /^http:\/\/api\.vitago\.test\/api\/v1\/repartidores\/(?:\?.*)?$/,
    (route) => {
      const url = new URL(route.request().url());
      consultas.push(url);
      const m = control.termino
        ? {
            ...almorzando,
            estado_operativo: "AVAILABLE",
            en_almuerzo: false,
            almuerzo_iniciado_en: null,
          }
        : almorzando;
      const datos = antiguo
        ? [anterior]
        : [m, pausa, anterior].filter(
            (item) =>
              !url.searchParams.has("en_almuerzo") ||
              item.en_almuerzo ===
                (url.searchParams.get("en_almuerzo") === "true"),
          );
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(pagina(datos)),
      });
    },
  );
  await page.route(
    /^http:\/\/api\.vitago\.test\/api\/v1\/solicitudes\/(?:\?.*)?$/,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(pagina([])),
      }),
  );
  return { todas, consultas, control };
}

test("el administrador accede a Almuerzos desde el menú y Administración y consulta el regreso", async ({
  page,
}) => {
  const { todas, control, consultas } = await preparar(page);
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: "Almuerzos", exact: true }),
  ).toBeVisible();
  await page.goto("/administracion");
  await page.getByRole("link", { name: /Revisar almuerzos/ }).click();
  await expect(page).toHaveURL(/\/almuerzos\?en_almuerzo=true$/);
  await expect(
    page.getByRole("heading", { name: "Almuerzos", exact: true }),
  ).toBeVisible();
  const tarjetas = page.getByRole("list", { name: "Almuerzos de motoristas" });
  await expect(tarjetas.locator(":scope > li")).toHaveCount(1);
  await expect(tarjetas).toContainText("29/10/2026, 12:00 (UTC-06:00)");
  await expect(tarjetas).not.toContainText("Pausa General");
  expect(consultas.at(-1)!.searchParams.get("en_almuerzo")).toBe("true");
  await page
    .getByRole("combobox", { name: "Almuerzo", exact: true })
    .selectOption("");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(tarjetas.locator(":scope > li")).toHaveCount(3);
  control.termino = true;
  await page.getByRole("button", { name: "Actualizar", exact: true }).click();
  const carlos = tarjetas
    .locator("li")
    .filter({ has: page.getByRole("heading", { name: "Carlos Mendoza" }) });
  await expect(carlos).toContainText("Fuera de almuerzo");
  await expect(carlos.locator("time")).toHaveCount(0);
  expect(
    todas
      .filter((r) => !r.ruta.endsWith("iniciar-sesion/"))
      .every((r) => r.metodo === "GET"),
  ).toBe(true);
  expect(todas.some((r) => r.ruta.includes("/almuerzo/"))).toBe(false);
});

test("Almuerzos informa si el servidor anterior no proporciona el estado", async ({
  page,
}) => {
  await preparar(page, true);
  await page.goto("/almuerzos?en_almuerzo=true");
  await expect(page.getByRole("status")).toContainText(
    "No se puede confirmar que haya aplicado este filtro",
  );
  const tarjetas = page.getByRole("list", { name: "Almuerzos de motoristas" });
  await expect(tarjetas).toContainText("Sin información de almuerzo");
  await expect(tarjetas).not.toContainText("Fuera de almuerzo");
});

test("sin repartidor.ver no ofrece acceso a Almuerzos ni consulta los motoristas", async ({
  page,
}) => {
  const { todas } = await preparar(page);
  await page.route("**/api/v1/usuarios/mi-perfil/", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...perfil, permisos: ["solicitud.ver"] }),
    }),
  );
  await page.goto("/administracion");
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: "Almuerzos", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /Revisar almuerzos/ }),
  ).toHaveCount(0);
  await page.goto("/almuerzos");
  await expect(
    page.getByRole("heading", { name: "No tienes acceso a este módulo" }),
  ).toBeVisible();
  expect(todas.some((r) => r.ruta === "/api/v1/repartidores/")).toBe(false);
});

test("la sección Almuerzos muestra la hora completa en teléfono, tableta y escritorio", async ({
  page,
}) => {
  await preparar(page);
  mkdirSync("artifacts/almuerzos", { recursive: true });
  for (const width of [320, 820, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/almuerzos");
    const tarjetas = page.getByRole("list", {
      name: "Almuerzos de motoristas",
    });
    await expect(tarjetas.locator(":scope > li")).toHaveCount(3);
    await expect(tarjetas.locator("time")).toHaveText(
      "29/10/2026, 12:00 (UTC-06:00)",
    );
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `artifacts/almuerzos/seccion-${width}.png`,
      fullPage: true,
    });
  }
});

test("directorio filtra por almuerzo en el servidor sin perder empresa ni paginación", async ({
  page,
}) => {
  const { consultas, todas } = await preparar(page);
  const empresa = perfil.empresa.id;
  await page.goto(
    `/motoristas?empresa_id=${empresa}&estado_operativo=PAUSED&pagina=4`,
  );
  await expect(page.getByRole("table")).toContainText(
    "Sin información de almuerzo",
  );
  await page
    .getByRole("combobox", { name: "Almuerzo", exact: true })
    .selectOption("true");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  const tabla = page.getByRole("table");
  await expect(tabla.getByText("En almuerzo", { exact: true })).toBeVisible();
  await expect(tabla).toContainText("29/10/2026, 12:00 (UTC-06:00)");
  await expect(tabla).not.toContainText("Pausa General");
  expect(consultas.at(-1)!.searchParams.get("empresa_id")).toBe(empresa);
  expect(consultas.at(-1)!.searchParams.get("estado_operativo")).toBe("PAUSED");
  expect(consultas.at(-1)!.searchParams.get("pagina")).toBe("1");
  expect(consultas.at(-1)!.searchParams.get("en_almuerzo")).toBe("true");
  await page
    .getByRole("combobox", { name: "Almuerzo", exact: true })
    .selectOption("false");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(tabla).toContainText("Pausa General");
  await expect(tabla).toContainText("Fuera de almuerzo");
  await expect(tabla).not.toContainText("Versión Anterior");
  expect(
    todas
      .filter((r) => !r.ruta.endsWith("iniciar-sesion/"))
      .every((r) => r.metodo === "GET"),
  ).toBe(true);
});

test("un despliegue antiguo no se representa como fuera de almuerzo ni confirma un filtro ignorado", async ({
  page,
}) => {
  await preparar(page, true);
  await page.goto("/motoristas?en_almuerzo=true");
  await expect(page.getByRole("status")).toContainText(
    "No se puede confirmar que haya aplicado este filtro",
  );
  const tabla = page.getByRole("table");
  await expect(tabla).toContainText("Sin información de almuerzo");
  await expect(tabla).not.toContainText("Fuera de almuerzo");
});

test("Monitorear distingue almuerzo, pausa y datos ausentes; solo consulta el estado", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-30T05:00:00Z") });
  const { control, todas } = await preparar(page);
  await page.goto("/monitorear");
  await expect(page.locator(".monitor-lista > li")).toHaveCount(3);
  await page
    .getByRole("combobox", { name: "Almuerzo", exact: true })
    .selectOption("true");
  await expect(page.locator(".monitor-lista > li")).toHaveCount(1);
  await page.locator(".monitor-lista button").click();
  const ficha = page.getByRole("region", {
    name: "Detalle del motorista seleccionado",
  });
  await expect(ficha).toContainText("En almuerzo");
  await expect(ficha.locator("time")).toHaveAttribute("datetime", inicio);
  await expect(
    page.getByRole("button", {
      name: /Iniciar almuerzo|Regresé|Finalizar almuerzo/,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Almuerzo", exact: true })
    .selectOption("false");
  await expect(page.locator(".monitor-lista > li")).toHaveCount(1);
  await expect(page.locator(".monitor-lista")).toContainText("Pausa General");
  await expect(ficha).toContainText("Selecciona un motorista");
  await page
    .getByRole("combobox", { name: "Almuerzo", exact: true })
    .selectOption("sin_dato");
  await expect(page.locator(".monitor-lista")).toContainText(
    "Versión Anterior",
  );
  await page
    .getByRole("combobox", { name: "Almuerzo", exact: true })
    .selectOption("true");
  control.termino = true;
  await page.getByRole("button", { name: "Actualizar", exact: true }).click();
  await expect(page.locator(".monitor-lista > li")).toHaveCount(0);
  expect(
    todas
      .filter((r) => !r.ruta.endsWith("iniciar-sesion/"))
      .every((r) => r.metodo === "GET"),
  ).toBe(true);
  expect(todas.some((r) => r.ruta.includes("/almuerzo/"))).toBe(false);
});

test("indicador, hora y filtro se adaptan a móvil, tableta y escritorio", async ({
  page,
}) => {
  test.setTimeout(60000);
  await preparar(page);
  mkdirSync("artifacts/almuerzos", { recursive: true });
  for (const width of [320, 820, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/motoristas?en_almuerzo=true");
    await expect(page.getByRole("table")).toContainText("En almuerzo");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: `artifacts/almuerzos/directorio-${width}.png`,
      fullPage: true,
    });
    await page.goto("/monitorear");
    await expect(page.locator(".monitor-lista > li")).toHaveCount(3);
    await page
      .getByRole("combobox", { name: "Almuerzo", exact: true })
      .selectOption("true");
    await page.locator(".monitor-lista button").click();
    await expect(
      page.getByRole("region", { name: "Detalle del motorista seleccionado" }),
    ).toContainText("29/10/2026, 12:00 (UTC-06:00)");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `artifacts/almuerzos/monitoreo-${width}.png`,
      fullPage: true,
    });
  }
});
