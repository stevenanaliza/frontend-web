import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import {
  cargarPantalla,
  prepararResponsive,
  rutaMotorista,
  rutaSolicitud,
  rutaUsuario,
} from "./soporte-responsive";

const rutas = [
  "/administracion",
  "/resumenes",
  rutaMotorista,
  "/motoristas?crear=1",
  "/usuarios",
  "/usuarios/nuevo",
  rutaUsuario,
  "/sucursales?crear=1",
  "/ubicaciones?crear=1",
  "/vehiculos?crear=1",
  "/empresas",
  "/solicitudes",
  "/solicitudes/nueva",
  rutaSolicitud,
  "/mi-cuenta",
  "/limites-motoristas",
  "/evidencias",
];
async function comprobarAcceso(page: Page) {
  await page.goto("/iniciar-sesion");
  await expect(
    page.getByRole("heading", { name: "Inicia sesión" }),
  ).toBeVisible();
  await expect(page.getByLabel("Correo electrónico")).toBeVisible();
  await expect(page.getByLabel("Contraseña", { exact: true })).toBeVisible();
  const dimensiones = await page.evaluate(() => ({
    documento: document.documentElement.scrollWidth,
    pantalla: document.documentElement.clientWidth,
    formulario: document
      .querySelector(".form-contenedor")!
      .getBoundingClientRect().bottom,
    pie: document.querySelector(".login-copyright")!.getBoundingClientRect()
      .top,
  }));
  expect(dimensiones.documento).toBeLessThanOrEqual(dimensiones.pantalla);
  expect(dimensiones.pie).toBeGreaterThanOrEqual(dimensiones.formulario);
}

for (const ancho of [320, 375, 600, 768, 820, 1024, 1280, 1440, 1920, 2560])
  test(`pantallas administrativas sin desbordamientos a ${ancho}px`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: ancho, height: 900 });
    await comprobarAcceso(page);
    const inesperadas = await prepararResponsive(page);
    const errores: unknown[] = [];
    for (const ruta of rutas) {
      await cargarPantalla(page, ruta);
      const fallo = await page.evaluate(() => {
        const ancho = document.documentElement.clientWidth;
        const fuera = [...document.querySelectorAll<HTMLElement>("main *")]
          .filter((el) => {
            if (
              el.closest(".tabla-scroll") ||
              getComputedStyle(el).visibility === "hidden"
            )
              return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && (r.right > ancho + 1 || r.left < -1);
          })
          .slice(0, 6)
          .map((el) => ({
            tag: el.tagName,
            clase: el.className,
            texto: el.innerText?.slice(0, 65),
          }));
        const controles =
          ancho <= 1024
            ? [
                ...document.querySelectorAll<HTMLElement>(
                  "main button, main input, main select, main textarea",
                ),
              ]
                .filter((el) => {
                  const r = el.getBoundingClientRect();
                  if (
                    !r.width ||
                    !r.height ||
                    el.matches('[type="radio"], [type="checkbox"]')
                  )
                    return false;
                  return (
                    r.height < 43.5 ||
                    (el.tagName !== "BUTTON" &&
                      parseFloat(getComputedStyle(el).fontSize) < 16)
                  );
                })
                .map((el) => ({
                  campo: el.getAttribute("name"),
                  texto: el.textContent?.slice(0, 60),
                  alto: el.getBoundingClientRect().height,
                  fuente: getComputedStyle(el).fontSize,
                }))
            : [];
        return document.documentElement.scrollWidth > ancho + 1 ||
          fuera.length ||
          controles.length
          ? {
              ancho,
              documento: document.documentElement.scrollWidth,
              fuera,
              controles,
              tablas: [
                ...document.querySelectorAll<HTMLElement>(".tabla-scroll"),
              ].map((el) => ({
                ancho: el.clientWidth,
                contenido: el.scrollWidth,
                derecha: el.getBoundingClientRect().right,
                overflow: getComputedStyle(el).overflow,
              })),
            }
          : null;
      });
      if (fallo) errores.push({ ruta, ...fallo });
      if (
        [375, 820, 1440].includes(ancho) &&
        ["/administracion", "/resumenes", "/solicitudes/nueva"].includes(ruta)
      ) {
        mkdirSync("artifacts/responsive", { recursive: true });
        await page.screenshot({
          path: `artifacts/responsive/${ruta.slice(1).replaceAll("/", "-")}-${ancho}.png`,
          fullPage: true,
        });
      }
    }
    expect(inesperadas).toEqual([]);
    expect(errores).toEqual([]);
  });

test.describe("uso táctil y orientación", () => {
  test.use({ hasTouch: true });

  test("el menú permite navegar, usar teclado y pasar de tableta a escritorio", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    const inesperadas = await prepararResponsive(page);
    const abrir = page.getByRole("button", { name: "Abrir navegación" });
    const cerrar = page.locator(".cerrar-menu");
    await abrir.tap();
    await expect(cerrar).toBeFocused();
    await expect(page.locator(".app-principal")).toHaveAttribute("inert", "");
    await page.keyboard.press("Shift+Tab");
    await expect(
      page
        .locator(".sidebar")
        .getByRole("button", { name: "Cerrar sesión", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(cerrar).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(abrir).toBeFocused();
    await abrir.tap();
    await page
      .getByRole("navigation")
      .getByRole("link", { name: "Administración", exact: true })
      .tap();
    await expect(
      page.getByRole("heading", { name: "Administración", exact: true }),
    ).toBeVisible();
    await expect(abrir).toHaveAttribute("aria-expanded", "false");
    await abrir.tap();
    await page.setViewportSize({ width: 1280, height: 820 });
    await expect(page.locator(".app-principal")).not.toHaveAttribute(
      "inert",
      "",
    );
    await expect(page.getByRole("navigation")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .toBe("");
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.getByRole("navigation")).toBeHidden();
    await abrir.tap();
    await cerrar.tap();
    await expect(abrir).toBeFocused();
    expect(inesperadas).toEqual([]);
  });

  test("acceso y formularios se desplazan en horizontal y con poco alto", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await comprobarAcceso(page);
    await page
      .getByLabel("Contraseña", { exact: true })
      .fill("prueba-horizontal");
    await page.getByRole("button", { name: "Mostrar contraseña" }).tap();
    await expect(
      page.getByLabel("Contraseña", { exact: true }),
    ).toHaveAttribute("type", "text");
    const inesperadas = await prepararResponsive(page);
    for (const ruta of [
      "/administracion",
      "/usuarios/nuevo",
      "/solicitudes/nueva",
      "/limites-motoristas",
    ]) {
      await cargarPantalla(page, ruta);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(844);
      const ultimo = page.locator("main button, main a[href]").last();
      await ultimo.scrollIntoViewIfNeeded();
      await expect(ultimo).toBeInViewport();
    }
    mkdirSync("artifacts/responsive", { recursive: true });
    await page.screenshot({
      path: "artifacts/responsive/limites-horizontal.png",
      fullPage: true,
    });
    expect(inesperadas).toEqual([]);
  });

  test("la tabla se recorre con teclado sin desplazar toda la página", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await prepararResponsive(page);
    const tabla = page.getByRole("region", { name: "Resúmenes de motoristas" });
    await tabla.focus();
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(() => tabla.evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(375);
    await tabla.evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });
    await expect(tabla.getByRole("link").last()).toBeInViewport();
  });

  test("conserva el contenido con texto del sistema ampliado y tema oscuro", async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setEmulatedOSTextScale", { scale: 2 });
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await comprobarAcceso(page);
    const inesperadas = await prepararResponsive(page);
    for (const ruta of [
      "/administracion",
      "/usuarios/nuevo",
      "/solicitudes/nueva",
      "/mi-cuenta",
    ]) {
      await cargarPantalla(page, ruta);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(375);
    }
    expect(inesperadas).toEqual([]);
  });
});
