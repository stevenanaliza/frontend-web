import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { lecturas, lista, perfil, resumen, tokens } from "../fixtures";

async function backend(
  page: Page,
  opciones: {
    operativo?: boolean;
    error?: number;
    vacio?: boolean;
    incompleto?: boolean;
    perfilParcial?: boolean;
  } = {},
) {
  const peticiones: URL[] = [];
  await page.route("http://api.vitago.test/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    peticiones.push(url);
    const responder = (datos: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(datos),
      });
    if (url.pathname.endsWith("iniciar-sesion/")) return responder(tokens);
    if (url.pathname.endsWith("mi-perfil/"))
      return responder(
        opciones.operativo
          ? {
              ...perfil,
              permisos: [
                "solicitud.ver_propias",
                "solicitud.ver_asignadas",
                "jornada.ver",
                "evidencia.ver",
              ],
            }
          : opciones.perfilParcial
            ? {
                ...perfil,
                permisos: perfil.permisos.filter((p) => p !== "jornada.ver"),
              }
            : perfil,
      );
    if (url.pathname.endsWith("cerrar-sesion/"))
      return route.fulfill({ status: 204 });
    if (url.pathname.endsWith("/solicitudes/agrupaciones/"))
      return responder({
        conteo: 0,
        pagina_siguiente: null,
        pagina_anterior: null,
        resultados: [],
      });
    if (opciones.error)
      return responder(
        opciones.error === 400
          ? { fecha_operativa: ["Fecha operativa inválida."] }
          : { detail: "Acceso denegado por el servidor." },
        opciones.error,
      );
    if (url.pathname.endsWith("resumenes/")) {
      if (opciones.vacio)
        return responder({ ...lista, conteo: 0, resultados: [] });
      return responder({
        ...lista,
        conteo: 21,
        pagina_siguiente:
          url.searchParams.get("pagina") === "2"
            ? null
            : "http://api.vitago.test/api/v1/repartidores/resumenes/?pagina=2",
        pagina_anterior:
          url.searchParams.get("pagina") === "2"
            ? "http://api.vitago.test/api/v1/repartidores/resumenes/"
            : null,
      });
    }
    if (url.pathname.endsWith("resumen/"))
      return responder(
        opciones.incompleto
          ? {
              ...resumen,
              kilometraje: {
                ...resumen.kilometraje,
                kilometros_medidos: null,
                kilometros_consolidados: "0.000",
                completo: false,
              },
              carga_actual: {
                ...resumen.carga_actual,
                solicitudes_sin_cantidad_tubos: 1,
                tubos_comprometidos: 4,
              },
              temperaturas: { ...resumen.temperaturas, promedio_c: "0.00" },
            }
          : resumen,
      );
    if (url.pathname.endsWith("temperaturas/"))
      return responder({
        ...lecturas,
        resultados: [
          lecturas.resultados[0],
          {
            ...lecturas.resultados[0],
            id: "lectura-cero",
            numero_solicitud: "SOL-CERO",
            temperatura_contenedor_c: "0.00",
            fuente_temperatura: "MANUAL",
          },
        ],
      });
    throw Error(`Petición no prevista en prueba: ${url.pathname}`);
  });
  return peticiones;
}
async function entrar(page: Page) {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill("admin@example.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("solo-prueba");
  await page.getByRole("button", { name: "Entrar al panel" }).click();
}
test("login, permisos, filtros, páginas remotas, detalle, null y cierre", async ({
  page,
}) => {
  const peticiones = await backend(page);
  await entrar(page);
  await expect(
    page.getByRole("heading", { name: "Resúmenes diarios" }),
  ).toBeVisible();
  expect(
    peticiones.filter((p) => p.pathname.endsWith("resumenes/")),
  ).toHaveLength(1);
  await page.getByLabel("Fecha operativa").fill("2026-10-27");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await expect(page).toHaveURL(/pagina=2/);
  expect(
    peticiones.some(
      (p) =>
        p.searchParams.get("pagina") === "2" &&
        p.searchParams.get("fecha_operativa") === "2026-10-27",
    ),
  ).toBe(true);
  expect(
    peticiones.every((p) => !p.searchParams.has("solicitada_por_id")),
  ).toBe(true);
  await page
    .getByRole("link", { name: "Ver detalle de Motorista De prueba" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Actividad del día", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Carga actual", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Histórico sin temperatura", exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "0.00 °C", exact: false }),
  ).toBeVisible();
  expect(peticiones.some((p) => p.pathname.endsWith("/temperaturas/"))).toBe(
    true,
  );
  await page.getByRole("link", { name: "Volver a resúmenes diarios" }).click();
  await expect(page).toHaveURL(/pagina=2/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Resúmenes diarios" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Inicia sesión" }),
  ).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
});
test("deniega acceso a usuarios operativos incluso por enlace directo", async ({
  page,
}) => {
  const peticiones = await backend(page, { operativo: true });
  await entrar(page);
  await expect(
    page.getByRole("heading", { name: "Tu cuenta no tiene acceso al panel" }),
  ).toBeVisible();
  await page.goto(`/motoristas/${resumen.repartidor.id}`);
  await expect(
    page.getByRole("heading", { name: "Tu cuenta no tiene acceso al panel" }),
  ).toBeVisible();
  expect(
    peticiones.some(
      (p) =>
        p.pathname.endsWith("resumenes/") || p.pathname.endsWith("resumen/"),
    ),
  ).toBe(false);
});
test("el 403 del servidor se muestra como falta de permisos", async ({
  page,
}) => {
  await backend(page, { error: 403 });
  await entrar(page);
  await expect(page.getByRole("alert")).toContainText(
    "Acceso denegado por el servidor.",
  );
  await expect(page.getByRole("alert")).not.toContainText("conectar");
});
test("conserva errores 400 por campo y distingue lista vacía", async ({
  page,
}) => {
  await backend(page, { error: 400 });
  await entrar(page);
  await expect(page.locator("#fecha_operativa-error")).toContainText(
    "Fecha operativa inválida.",
  );
});
test("lista vacía", async ({ page }) => {
  await backend(page, { vacio: true });
  await entrar(page);
  await expect(
    page.getByRole("heading", { name: "Sin motoristas para estos filtros" }),
  ).toBeVisible();
});
test("un permiso faltante oculta el módulo y bloquea el endpoint", async ({
  page,
}) => {
  const peticiones = await backend(page, { perfilParcial: true });
  await entrar(page);
  await expect(page).toHaveURL(/\/solicitudes$/);
  await page.goto("/resumenes");
  await expect(
    page.getByRole("heading", { name: "No tienes acceso a estos reportes" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: "Resúmenes diarios" }),
  ).toHaveCount(0);
  expect(peticiones.some((p) => p.pathname.endsWith("resumenes/"))).toBe(false);
});
test("el bloqueo 429 respeta la espera y no repite el login", async ({
  page,
}) => {
  let intentos = 0;
  await page.route(
    "http://api.vitago.test/api/v1/autenticacion/iniciar-sesion/",
    async (route) => {
      intentos++;
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        headers: { "Retry-After": "60" },
        body: JSON.stringify({
          detail: "Demasiados intentos. Espere.",
          segundos_espera: 60,
        }),
      });
    },
  );
  await entrar(page);
  await expect(page.getByRole("alert")).toContainText(
    "Demasiados intentos. Espere.",
  );
  await expect(
    page.getByRole("button", { name: /Intenta de nuevo en/ }),
  ).toBeDisabled();
  expect(intentos).toBe(1);
});
test("la desconexión se muestra sin reintentos automáticos", async ({
  page,
}) => {
  const peticiones = await backend(page);
  await page.route(
    "http://api.vitago.test/api/v1/repartidores/resumenes/**",
    (route) => route.abort("connectionrefused"),
  );
  await entrar(page);
  await expect(page.getByRole("alert")).toContainText(
    "No se pudo conectar con el servidor",
  );
  expect(
    peticiones.filter((p) => p.pathname.endsWith("renovar/")),
  ).toHaveLength(0);
});
test("detalle distingue ceros, históricos desconocidos y carga parcial", async ({
  page,
}) => {
  await backend(page, { incompleto: true });
  await entrar(page);
  await page
    .getByRole("link", { name: "Ver detalle de Motorista De prueba" })
    .click();
  await expect(
    page.getByText("Información incompleta", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Sin dato", { exact: true })).toBeVisible();
  await expect(page.getByText("Carga parcial", { exact: true })).toBeVisible();
  await expect(page.getByText("0.000", { exact: true })).toBeVisible();
});
test("capturas y diseño sin desbordamiento en escritorio y tablet", async ({
  page,
}) => {
  mkdirSync("artifacts", { recursive: true });
  await backend(page);
  await page.goto("/");
  await page.screenshot({
    path: "artifacts/login-escritorio.png",
    fullPage: true,
  });
  await entrar(page);
  await expect(
    page.getByRole("heading", { name: "Resúmenes diarios" }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/resumenes-escritorio.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Ver detalle de Motorista De prueba" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Carga actual", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/detalle-escritorio.png",
    fullPage: true,
  });
  for (const width of [1024, 768, 375]) {
    await page.setViewportSize({ width, height: 1024 });
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    await page.screenshot({
      path: `artifacts/detalle-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.getByRole("button", { name: "Abrir navegación" }).click();
  await expect(
    page.getByRole("navigation", { name: "Navegación principal" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Abrir navegación" }),
  ).toBeFocused();
  await expect(
    page.getByRole("navigation", { name: "Navegación principal" }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Abrir navegación" }).click();
  await page
    .getByRole("button", { name: "Cerrar navegación", exact: true })
    .first()
    .click();
});
