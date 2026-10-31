import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { simularGoogleMaps } from "./mapa-doble";
import { abrirMonitoreo, prepararMonitoreo } from "./soporte-monitoreo";
// Las trazas de una comprobación real no deben guardar URLs con la clave web.
if (process.env.VITAGO_MAPA_REAL === "1")
  test.use({ trace: "off", screenshot: "off" });

test("seleccionar un punto muestra la carga, las solicitudes, frascos y vehículo", async ({
  page,
}) => {
  await simularGoogleMaps(page);
  const { peticiones, inesperadas } = await prepararMonitoreo(page);
  await abrirMonitoreo(page);
  const puntos = page.locator("gmp-marcador-prueba");
  await expect(puntos).toHaveCount(2);
  await puntos.first().click();
  const ficha = page.getByRole("region", {
    name: "Detalle del motorista seleccionado",
  });
  await expect(
    ficha.getByRole("heading", { name: "Carlos Mendoza" }),
  ).toBeVisible();
  await expect(
    ficha.getByText("Tubos en transporte", { exact: true }),
  ).toBeVisible();
  await expect(ficha.getByText("3 tubos · 2 frascos")).toHaveCount(2);
  await expect(
    ficha.getByText("Frascos en transporte", { exact: true }),
  ).toBeVisible();
  await expect(
    ficha.getByText("Ver artículos históricos en el detalle"),
  ).toHaveCount(2);
  await expect(ficha.getByText("2 / 5", { exact: true })).toBeVisible();
  await expect(ficha.getByText("6 / 20", { exact: true })).toBeVisible();
  await expect(ficha.getByText(/HBA-1234/)).toBeVisible();
  await expect(ficha.getByRole("link")).toHaveCount(4);
  expect(
    peticiones
      .filter((p) => !p.ruta.endsWith("iniciar-sesion/"))
      .every((p) => p.metodo === "GET"),
  ).toBe(true);
  expect(inesperadas).toEqual([]);
});

test("actualiza, elimina posiciones al terminar y pausa sin repetir consultas", async ({
  page,
}) => {
  await page.clock.install();
  await simularGoogleMaps(page);
  const { control, peticiones } = await prepararMonitoreo(page);
  await abrirMonitoreo(page);
  await expect(page.locator("gmp-marcador-prueba")).toHaveCount(2);
  const inicial = peticiones.length;
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByRole("status")).toContainText("pestaña oculta");
  await page.clock.fastForward(30_000);
  expect(peticiones).toHaveLength(inicial);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(
    page.getByRole("button", { name: "Actualizar", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Pausar actualización" }).click();
  const cantidad = peticiones.length;
  await page.clock.fastForward(30_000);
  expect(peticiones).toHaveLength(cantidad);
  control.finalizar = true;
  await page.getByRole("button", { name: "Activar actualización" }).click();
  await expect(page.locator("gmp-marcador-prueba")).toHaveCount(0);
  await expect(
    page.getByText("0 motoristas · 0 con ubicación · 0 sin punto disponible", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Administración", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Administración", exact: true }),
  ).toBeVisible();
  const alSalir = peticiones.length;
  await page.clock.fastForward(30_000);
  expect(peticiones).toHaveLength(alSalir);
});

test("un fallo de GPS oculta el punto y suspende la actualización automática", async ({
  page,
}) => {
  await page.clock.install();
  await simularGoogleMaps(page);
  const { control, peticiones } = await prepararMonitoreo(page);
  await abrirMonitoreo(page);
  control.errorGps = 500;
  await page.getByRole("button", { name: "Actualizar", exact: true }).click();
  await expect(page.locator("gmp-marcador-prueba")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("pausada por un error");
  const cantidad = peticiones.length;
  await page.clock.fastForward(30_000);
  expect(peticiones).toHaveLength(cantidad);
  control.errorGps = 0;
  await page.getByRole("button", { name: "Actualizar", exact: true }).click();
  await expect(page.locator("gmp-marcador-prueba")).toHaveCount(2);
});

test("deniega navegación y lectura GPS sin el permiso oficial", async ({
  page,
}) => {
  const { peticiones } = await prepararMonitoreo(page, false);
  await expect(
    page.getByRole("link", { name: "Monitorear", exact: true }),
  ).toHaveCount(0);
  await page.goto("/monitorear");
  await expect(page.getByText("No tienes acceso a este módulo")).toBeVisible();
  expect(
    peticiones.some(
      (p) =>
        p.ruta === "/api/v1/seguimiento/motoristas/" ||
        p.ruta.endsWith("/seguimiento/") ||
        p.ruta === "/api/v1/repartidores/",
    ),
  ).toBe(false);
});

test("la recuperación 503 durante el GPS informa la espera y no conserva puntos antiguos", async ({
  page,
}) => {
  await page.clock.install();
  await simularGoogleMaps(page);
  const { control, peticiones } = await prepararMonitoreo(page);
  await abrirMonitoreo(page);
  await expect(page.locator("gmp-marcador-prueba")).toHaveCount(2);
  control.errorGps = 503;
  await page.getByRole("button", { name: "Actualizar", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "recuperando el cierre operativo",
  );
  await expect(page.locator("gmp-marcador-prueba")).toHaveCount(0);
  const reintentar = page.getByRole("button", { name: "Volver a intentar" });
  await expect(reintentar).toBeDisabled();
  const antes = peticiones.length;
  await page.clock.fastForward(4000);
  await expect(reintentar).toBeDisabled();
  expect(peticiones).toHaveLength(antes);
  control.errorGps = 0;
  await page.clock.fastForward(1250);
  await expect(reintentar).toBeEnabled();
  expect(peticiones).toHaveLength(antes);
  await reintentar.click();
  await expect(page.locator("gmp-marcador-prueba")).toHaveCount(2);
});

test("un error de Google Maps mantiene accesibles el listado y la ficha", async ({
  page,
}) => {
  await simularGoogleMaps(page, true);
  await prepararMonitoreo(page);
  await abrirMonitoreo(page);
  await expect(page.getByRole("alert")).toContainText(
    "Google Maps no está disponible",
  );
  await page.getByRole("button", { name: /Sin señal De prueba/ }).click();
  await expect(
    page.getByRole("region", { name: "Detalle del motorista seleccionado" }),
  ).toContainText("Sin ubicación disponible");
});

test("mapa y ficha caben en móvil, tableta, escritorio y horizontal", async ({
  page,
}) => {
  test.setTimeout(60000);
  await simularGoogleMaps(page);
  await prepararMonitoreo(page);
  await abrirMonitoreo(page);
  mkdirSync("artifacts/monitoreo", { recursive: true });
  for (const viewport of [
    { width: 320, height: 780 },
    { width: 375, height: 812 },
    { width: 820, height: 1180 },
    { width: 1440, height: 1000 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page
      .locator(".monitor-lista")
      .getByRole("button", { name: /Elena De prueba/ })
      .click();
    await expect(
      page.getByRole("region", { name: "Detalle del motorista seleccionado" }),
    ).toContainText("3 tubos · 2 frascos");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(viewport.width);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `artifacts/monitoreo/monitor-${viewport.width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Cerrar información del motorista" })
      .click();
  }
});

test("Google Maps real carga y permite abrir la ficha con la clave local", async ({
  page,
}) => {
  test.skip(
    process.env.VITAGO_MAPA_REAL !== "1",
    "Requiere clave web y autorización del origen local.",
  );
  test.setTimeout(60000);
  await prepararMonitoreo(page);
  await abrirMonitoreo(page);
  await expect(page.locator(".monitor-pin")).toHaveCount(2, { timeout: 25000 });
  await page.locator(".monitor-pin").first().click();
  await expect(
    page.getByRole("region", { name: "Detalle del motorista seleccionado" }),
  ).toContainText("Tubos en transporte");
});
