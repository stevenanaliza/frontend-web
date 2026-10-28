import { test, expect, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { perfil, tokens, lista } from "../fixtures";

const origen = "http://127.0.0.1:5184";
const apiOrigen = "http://127.0.0.1:5185";
const clave = `vitago:corporate:${apiOrigen}:sesion`;
const usuarioId = "11111111-1111-4111-8111-111111111111";
const perfilWeb = {
  ...perfil,
  usuario: { ...perfil.usuario, id: usuarioId },
  permisos: [...perfil.permisos, "usuario.administrar"],
};
let backend: Server;
let accesoVencido = false;
let rechazarRenovacion = false;
let rechazarPerfil = false;
let renovaciones = 0;
let preflights = 0;
let cambios = 0;
let autorizacion = "Bearer acceso-prueba";
const peticiones: { ruta: string; metodo: string; bearer?: string }[] = [];

test.beforeAll(async () => {
  // Solo es un backend de pruebas. El panel compilado se sirve como archivos
  // estáticos mediante Vite preview, sin adaptador de sesiones ni cookies.
  backend = createServer(async (req, res) => {
    if (req.headers.origin === origen) {
      res.setHeader("Access-Control-Allow-Origin", origen);
      res.setHeader("Vary", "Origin");
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PATCH, DELETE, OPTIONS",
      );
      res.setHeader(
        "Access-Control-Allow-Headers",
        "authorization, content-type",
      );
    }
    if (req.method === "OPTIONS") {
      preflights++;
      res.statusCode = 204;
      return res.end();
    }
    const ruta = new URL(req.url!, apiOrigen).pathname;
    peticiones.push({
      ruta,
      metodo: req.method!,
      bearer: req.headers.authorization,
    });
    res.setHeader("Content-Type", "application/json");
    if (ruta.endsWith("/iniciar-sesion/"))
      return res.end(
        JSON.stringify({
          ...tokens,
          ...(accesoVencido
            ? { expira_token_acceso_en: "2000-01-01T00:00:00Z" }
            : {}),
        }),
      );
    if (ruta.endsWith("/renovar/")) {
      renovaciones++;
      let cuerpo = "";
      for await (const parte of req) cuerpo += parte;
      if (
        rechazarRenovacion ||
        JSON.parse(cuerpo).token_refresco !== tokens.token_refresco
      ) {
        res.statusCode = 401;
        return res.end(JSON.stringify({ detail: "Sesión revocada." }));
      }
      autorizacion = "Bearer acceso-rotado";
      return res.end(
        JSON.stringify({
          ...tokens,
          token_acceso: "acceso-rotado",
          token_refresco: "refresco-rotado",
        }),
      );
    }
    if (req.headers.authorization !== autorizacion) {
      res.statusCode = 401;
      return res.end("{}");
    }
    if (ruta.endsWith("/mi-perfil/")) {
      if (rechazarPerfil) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ detail: "Error interno de prueba." }));
      }
      return res.end(JSON.stringify(perfilWeb));
    }
    if (ruta.endsWith("/repartidores/resumenes/"))
      return res.end(JSON.stringify(lista));
    if (ruta.endsWith("/restablecer-contrasena/")) {
      cambios++;
      res.statusCode = 204;
      return res.end();
    }
    if (
      ruta.endsWith("/cerrar-todas-las-sesiones/") ||
      ruta.endsWith("/cerrar-sesion/")
    ) {
      res.statusCode = 204;
      return res.end();
    }
    res.statusCode = 404;
    res.end("{}");
  });
  await new Promise<void>((resolve) =>
    backend.listen(5185, "127.0.0.1", resolve),
  );
});
test.beforeEach(() => {
  accesoVencido = false;
  rechazarRenovacion = false;
  rechazarPerfil = false;
  renovaciones = preflights = cambios = 0;
  autorizacion = "Bearer acceso-prueba";
  peticiones.length = 0;
});
test.afterAll(async () => {
  if (backend)
    await new Promise<void>((resolve) => {
      backend.closeAllConnections();
      backend.close(() => resolve());
    });
});
async function acceder(page: Page) {
  await page.goto(origen);
  await page.getByLabel("Correo electrónico").fill("admin@example.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("solo-prueba");
  await page.getByRole("button", { name: "Entrar al panel" }).click();
  await expect(
    page.getByRole("heading", { name: "Resúmenes diarios", exact: true }),
  ).toBeVisible();
}
async function sesionGuardada(page: Page) {
  return page.evaluate((key) => sessionStorage.getItem(key), clave);
}

test("un perfil 500 después del login permite reintentar GET sin repetir credenciales", async ({
  page,
}) => {
  rechazarPerfil = true;
  await page.goto(origen);
  await page.getByLabel("Correo electrónico").fill("admin@example.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("solo-prueba");
  await page.getByRole("button", { name: "Entrar al panel" }).click();
  await expect(
    page.getByRole("heading", { name: "No pudimos cargar tu perfil" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Entrar al panel" }),
  ).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText(
    "El servidor no pudo completar la operación",
  );
  expect(await sesionGuardada(page)).not.toBeNull();
  expect(peticiones.filter((p) => p.ruta.endsWith("mi-perfil/")).length).toBe(
    1,
  );
  rechazarPerfil = false;
  await page.getByRole("button", { name: "Reintentar perfil" }).click();
  await expect(
    page.getByRole("heading", { name: "Resúmenes diarios", exact: true }),
  ).toBeVisible();
  expect(peticiones.filter((p) => p.ruta.endsWith("mi-perfil/")).length).toBe(
    2,
  );
  expect(
    peticiones.filter((p) => p.ruta.endsWith("iniciar-sesion/")).length,
  ).toBe(1);
  expect(renovaciones).toBe(0);
});

test("un perfil 500 persistente no provoca bucles y permite salir localmente", async ({
  page,
}) => {
  await acceder(page);
  rechazarPerfil = true;
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "No pudimos cargar tu perfil" }),
  ).toBeVisible();
  const antes = peticiones.filter((p) => p.ruta.endsWith("mi-perfil/")).length;
  await page.getByRole("button", { name: "Reintentar perfil" }).click();
  await expect(
    page.getByRole("heading", { name: "No pudimos cargar tu perfil" }),
  ).toBeVisible();
  expect(peticiones.filter((p) => p.ruta.endsWith("mi-perfil/")).length).toBe(
    antes + 1,
  );
  expect(
    peticiones.filter((p) => p.ruta.endsWith("iniciar-sesion/")).length,
  ).toBe(1);
  await page
    .getByRole("button", { name: "Volver al inicio de sesión" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Inicia sesión" }),
  ).toBeVisible();
  expect(await sesionGuardada(page)).toBeNull();
});

test("compilación estática accede directamente con JWT y CORS, recupera la sesión y sale sin cookies", async ({
  page,
  context,
}) => {
  const solicitudesPanel: string[] = [];
  page.on("request", (req) => {
    if (req.url().startsWith(origen))
      solicitudesPanel.push(new URL(req.url()).pathname);
  });
  await acceder(page);
  expect(preflights).toBeGreaterThan(0);
  expect(peticiones.find((p) => p.ruta.endsWith("mi-perfil/"))?.bearer).toBe(
    "Bearer acceso-prueba",
  );
  expect(await sesionGuardada(page)).not.toBeNull();
  expect(await context.cookies()).toEqual([]);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Resúmenes diarios", exact: true }),
  ).toBeVisible();
  await page.goto(`${origen}/mi-cuenta`);
  await expect(
    page.getByRole("heading", { name: "Mi cuenta", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Inicia sesión" }),
  ).toBeVisible();
  expect(await sesionGuardada(page)).toBeNull();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Inicia sesión" }),
  ).toBeVisible();
  expect(
    solicitudesPanel.some(
      (ruta) => ruta.startsWith("/api/") || ruta.startsWith("/web/"),
    ),
  ).toBe(false);
});

test("renueva el par JWT vencido directamente en Django antes de consultar el perfil", async ({
  page,
}) => {
  accesoVencido = true;
  await acceder(page);
  expect(renovaciones).toBe(1);
  const guardado = JSON.parse((await sesionGuardada(page))!);
  expect(guardado.token_acceso).toBe("acceso-rotado");
  expect(guardado.token_refresco).toBe("refresco-rotado");
  expect(peticiones.find((p) => p.ruta.endsWith("mi-perfil/"))?.bearer).toBe(
    "Bearer acceso-rotado",
  );
  expect(
    peticiones.find((p) => p.ruta.endsWith("renovar/"))?.bearer,
  ).toBeUndefined();
});

test("cambiar mi contraseña usa Django y borra el JWT para exigir un nuevo acceso", async ({
  page,
}) => {
  await acceder(page);
  await page.goto(`${origen}/mi-cuenta`);
  await page
    .getByRole("button", { name: "Cambiar mi contraseña", exact: true })
    .click();
  await page
    .getByLabel("Nueva contraseña", { exact: true })
    .fill("Nueva-prueba-segura-2026!");
  await page
    .getByLabel("Confirmar nueva contraseña", { exact: true })
    .fill("Nueva-prueba-segura-2026!");
  await page
    .getByRole("button", { name: "Confirmar nueva contraseña", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Inicia sesión" }),
  ).toBeVisible();
  expect(cambios).toBe(1);
  expect(await sesionGuardada(page)).toBeNull();
});

test("cerrar todas las sesiones llama a Django y elimina las credenciales locales", async ({
  page,
}) => {
  await acceder(page);
  await page.goto(`${origen}/mi-cuenta`);
  await page
    .getByLabel("Confirmo que quiero cerrar todas mis sesiones.")
    .check();
  await page
    .getByRole("button", { name: "Cerrar todas las sesiones", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Inicia sesión" }),
  ).toBeVisible();
  expect(await sesionGuardada(page)).toBeNull();
  expect(
    peticiones.filter((p) => p.ruta.endsWith("cerrar-todas-las-sesiones/"))
      .length,
  ).toBe(1);
});

test("una renovación rechazada borra la sesión y no crea un ciclo de reintentos", async ({
  page,
}) => {
  await acceder(page);
  await page.evaluate((key) => {
    const datos = JSON.parse(sessionStorage.getItem(key)!);
    datos.expira_token_acceso_en = "2000-01-01T00:00:00Z";
    sessionStorage.setItem(key, JSON.stringify(datos));
  }, clave);
  rechazarRenovacion = true;
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Inicia sesión" }),
  ).toBeVisible();
  expect(await sesionGuardada(page)).toBeNull();
  expect(renovaciones).toBe(1);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Inicia sesión" }),
  ).toBeVisible();
  expect(renovaciones).toBe(1);
});
