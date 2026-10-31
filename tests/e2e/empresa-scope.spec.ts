import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import {
  ejemplosSeccion,
  lista,
  motorista,
  perfil,
  sucursal,
  tokens,
} from "../fixtures";
import { simularGoogleMaps } from "./mapa-doble";

const propia = perfil.empresa.id;
const ajena = "22222222-2222-4222-8222-222222222222";
const empresaBase = ejemplosSeccion(
  "### `GET /api/v1/organizaciones/empresas/`",
)[0].resultados[0];
const opciones = ejemplosSeccion(
  "### `GET /api/v1/solicitudes/opciones-creacion/`",
)[0];
const servicios = ejemplosSeccion(
  "### `GET /api/v1/solicitudes/tipos-servicio/`",
)[0];
async function preparar(page: Page, network = false, globalCorporate = false) {
  await page.route("https://fonts.googleapis.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/css", body: "" }),
  );
  const consultas: URL[] = [];
  const desconocidas: string[] = [];
  const usuario = {
    ...perfil,
    empresa: network ? null : perfil.empresa,
    roles: network
      ? [
          {
            codigo: "OPERADOR_RED",
            nombre: "Administración Network",
            tipo_alcance: "GLOBAL",
            empresa_id: null,
            sucursal_id: null,
          },
        ]
      : perfil.roles.map((r) =>
          globalCorporate
            ? { ...r, tipo_alcance: "GLOBAL", empresa_id: null }
            : r,
        ),
    permisos: [
      ...perfil.permisos,
      "empresa.ver",
      "empresa.administrar",
      "ubicacion.ver",
      "vehiculo.ver",
      "vehiculo.administrar",
      "solicitud.crear",
      "usuario.administrar",
      "rol.asignar",
      "repartidor.ver_ubicacion",
    ],
  };
  const paginar = (resultados: unknown[]) => ({
    conteo: resultados.length,
    pagina_siguiente: null,
    pagina_anterior: null,
    resultados,
  });
  const empresa = (id: string) => ({
    ...empresaBase,
    id,
    nombre: id === propia ? "Analiza" : "Empresa ajena",
  });
  await page.route("http://api.vitago.test/api/v1/**", async (route) => {
    const url = new URL(route.request().url()),
      ruta = url.pathname;
    consultas.push(url);
    const responder = (valor: unknown) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(valor),
      });
    if (ruta.endsWith("iniciar-sesion/")) return responder(tokens);
    if (ruta.endsWith("mi-perfil/")) return responder(usuario);
    if (ruta.endsWith("/repartidores/resumenes/")) return responder(lista);
    if (ruta === "/api/v1/seguimiento/motoristas/") {
      const base = ejemplosSeccion("## 0.45.0 — Ubicación administrativa")[0];
      return responder({
        ...base,
        resultados: [propia, ajena].map((id, i) => ({
          ...base.resultados[0],
          empresa_id: id,
          repartidor_id: i ? "motorista-ajeno" : motorista.id,
          usuario_id: motorista.usuario.id,
          nombre: i ? "Delivery Ajeno" : "Carlos Mendoza",
          ubicacion: null,
          estado_ubicacion: "SIN_UBICACION",
          ubicacion_vigente: false,
          antiguedad_segundos: null,
        })),
      });
    }
    if (ruta === "/api/v1/repartidores/")
      return responder(
        paginar([
          {
            ...motorista,
            empresa_id: propia,
            en_almuerzo: true,
            almuerzo_iniciado_en: "2026-10-30T12:00:00-06:00",
          },
          // El monitoreo debe descartar el registro ajeno, incluso ante una respuesta incompatible.
          ...(page.url().includes("/monitorear")
            ? [
                {
                  ...motorista,
                  id: "motorista-ajeno",
                  empresa_id: ajena,
                  usuario: {
                    ...motorista.usuario,
                    nombres: "Delivery",
                    apellidos: "Ajeno",
                  },
                },
              ]
            : []),
        ]),
      );
    if (ruta === "/api/v1/organizaciones/empresas/")
      return responder(paginar([empresa(propia), empresa(ajena)]));
    if (ruta.endsWith("/limites-motoristas/"))
      return responder({
        alcance: "EMPRESA",
        empresa_id: ruta.split("/")[5],
        limite_tubos: 20,
        limite_frascos: 20,
        limite_solicitudes: 5,
      });
    if (ruta.endsWith("/sucursales/"))
      return responder(paginar([{ ...sucursal, empresa_id: propia }]));
    if (/^\/api\/v1\/organizaciones\/empresas\/[^/]+\/$/.test(ruta))
      return responder(empresa(ruta.split("/")[5]));
    if (ruta.endsWith("/opciones-creacion/"))
      return responder({
        ...opciones,
        empresa_id: url.searchParams.get("empresa_id"),
      });
    if (ruta.endsWith("/tipos-servicio/")) return responder(servicios);
    if (ruta.endsWith("/roles-asignables/"))
      return responder({ resultados: [] });
    if (
      [
        "/api/v1/vehiculos/",
        "/api/v1/ubicaciones/",
        "/api/v1/solicitudes/agrupaciones/",
        "/api/v1/solicitudes/",
      ].includes(ruta)
    )
      return responder(paginar([]));
    desconocidas.push(ruta);
    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: "{}",
    });
  });
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill("admin@example.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("prueba");
  await page.getByRole("button", { name: "Entrar al panel" }).click();
  await expect(
    page.getByRole("heading", { name: "Resúmenes diarios", exact: true }),
  ).toBeVisible();
  return { consultas, desconocidas };
}

test("Corporate oculta la empresa y consulta la propia aunque la URL indique otra", async ({
  page,
}) => {
  test.setTimeout(60000);
  const { consultas, desconocidas } = await preparar(page);
  for (const ruta of [
    "almuerzos",
    "motoristas",
    "resumenes",
    "solicitudes",
    "limites-motoristas",
    "vehiculos",
    "ubicaciones",
    "sucursales",
    "solicitudes/nueva",
    "usuarios/nuevo",
    "empresas",
  ]) {
    await page.goto(`/${ruta}?empresa_id=${ajena}`);
    await expect(page.locator("h1")).toBeVisible();
    await expect(
      page.getByRole("textbox", {
        name: /ID de empresa|ID de la empresa autorizada/,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Seleccionar otra empresa autorizada", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Cambiar empresa", exact: true }),
    ).toHaveCount(0);
  }
  await expect(
    page.getByRole("heading", { name: "Mi empresa", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      consultas.some(
        (u) => u.pathname === `/api/v1/organizaciones/empresas/${propia}/`,
      ),
    )
    .toBe(true);
  const porEmpresa = consultas.filter((u) => u.searchParams.has("empresa_id"));
  expect(porEmpresa.length).toBeGreaterThan(5);
  expect(
    porEmpresa.every((u) => u.searchParams.get("empresa_id") === propia),
  ).toBe(true);
  expect(consultas.some((u) => u.pathname.includes(`/${ajena}/`))).toBe(false);
  expect(
    consultas.some((u) => u.pathname === "/api/v1/organizaciones/empresas/"),
  ).toBe(false);
  expect(desconocidas).toEqual([]);
  await page.goto(`/almuerzos?empresa_id=${ajena}`);
  await page
    .getByRole("combobox", { name: "Almuerzo", exact: true })
    .selectOption("true");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page).not.toHaveURL(/empresa_id/);
  await expect
    .poll(() => consultas.at(-1)?.searchParams.get("empresa_id"))
    .toBe(propia);
});

test("Network conserva el filtro y permite consultar la empresa seleccionada", async ({
  page,
}) => {
  const { consultas } = await preparar(page, true);
  await page.goto("/almuerzos");
  const campo = page.getByRole("textbox", {
    name: "ID de empresa",
    exact: true,
  });
  await expect(campo).toBeVisible();
  await campo.fill(ajena);
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect
    .poll(() => consultas.at(-1)?.searchParams.get("empresa_id"))
    .toBe(ajena);
  await page.goto("/resumenes");
  await page.getByRole("button", { name: "Más filtros" }).click();
  await page
    .getByRole("textbox", { name: "ID de empresa", exact: true })
    .fill(ajena);
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect
    .poll(() => consultas.at(-1)?.searchParams.get("empresa_id"))
    .toBe(ajena);
  await page.goto(`/vehiculos?empresa_id=${ajena}`);
  await expect(
    page.getByRole("textbox", { name: "ID de empresa", exact: true }),
  ).toHaveValue(ajena);
  await page.goto("/empresas");
  await expect(page.getByRole("table")).toContainText("Empresa ajena");
});

test("un alcance global de Corporate no muestra el selector de Network", async ({
  page,
}) => {
  const { consultas } = await preparar(page, false, true);
  await page.goto(`/motoristas?empresa_id=${ajena}`);
  await expect(page.getByRole("table")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "ID de empresa", exact: true }),
  ).toHaveCount(0);
  expect(consultas.at(-1)!.searchParams.get("empresa_id")).toBe(propia);
});

test("Monitorear Corporate solo muestra sus deliverys y la vista móvil no pide empresa", async ({
  page,
}) => {
  await simularGoogleMaps(page);
  const { consultas } = await preparar(page);
  await page.goto(`/monitorear?empresa_id=${ajena}`);
  await expect(page.locator(".monitor-lista > li")).toHaveCount(1);
  await expect(page.locator(".monitor-lista")).not.toContainText(
    "Delivery Ajeno",
  );
  expect(
    consultas
      .filter((u) => ["/api/v1/seguimiento/motoristas/"].includes(u.pathname))
      .every((u) => u.searchParams.get("empresa_id") === propia),
  ).toBe(true);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/almuerzos");
  await expect(
    page.getByRole("list", { name: "Almuerzos de motoristas" }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "ID de empresa", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  mkdirSync("artifacts/empresa", { recursive: true });
  await page.screenshot({
    path: "artifacts/empresa/corporate-almuerzos-320.png",
    fullPage: true,
  });
});
