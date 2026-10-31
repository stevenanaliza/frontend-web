import { expect, test, type Page } from "@playwright/test";
import { ejemplosSeccion, motorista, perfil } from "../fixtures";
import { simularGoogleMaps } from "./mapa-doble";
import { prepararMonitoreo } from "./soporte-monitoreo";

const base = ejemplosSeccion("## 0.45.0 — Ubicación administrativa")[0];
function muestra() {
  return {
    ...base,
    resultados: [
      {
        ...base.resultados[0],
        repartidor_id: motorista.id,
        usuario_id: motorista.usuario.id,
        nombre: "Carlos Mendoza",
        empresa_id: perfil.empresa.id,
      },
    ],
  };
}
async function preparar(page: Page) {
  await page.route("https://fonts.googleapis.com/**", (r) =>
    r.fulfill({ status: 200, contentType: "text/css", body: "" }),
  );
  await simularGoogleMaps(page);
  await prepararMonitoreo(page);
}

test("muestra GPS de espera y almuerzo sin solicitudes y sin requerir permiso de pedidos", async ({
  page,
}) => {
  await preparar(page);
  await page.route("**/api/v1/usuarios/mi-perfil/", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...perfil,
        permisos: ["repartidor.ver_ubicacion"],
      }),
    }),
  );
  const peticiones: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("api.vitago.test"))
      peticiones.push(new URL(r.url()).pathname);
  });
  const datos = muestra();
  datos.resultados[0] = {
    ...datos.resultados[0],
    en_almuerzo: true,
    estado_operativo: "PAUSED",
  };
  await page.route("**/api/v1/seguimiento/motoristas/**", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(datos),
    }),
  );
  await page.goto("/monitorear");
  await expect(page.locator("gmp-marcador-prueba")).toHaveCount(1);
  await page.locator("gmp-marcador-prueba").click();
  const ficha = page.getByRole("region", {
    name: "Detalle del motorista seleccionado",
  });
  await expect(ficha).toContainText("En almuerzo");
  await expect(ficha).toContainText("Servicios activos0");
  await expect(ficha).toContainText(
    "Tu cuenta permite consultar la ubicación y la jornada",
  );
  expect(
    peticiones.some(
      (r) =>
        r.startsWith("/api/v1/solicitudes/") ||
        r.startsWith("/api/v1/repartidores/"),
    ),
  ).toBe(false);
  await page
    .getByRole("combobox", { name: "Servicios", exact: true })
    .selectOption("false");
  await expect(page.locator("gmp-marcador-prueba")).toHaveCount(1);
});

test("respeta el intervalo y umbrales del servidor con el reloj del navegador desalineado", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2040-01-01T00:00:00Z") });
  await preparar(page);
  const datos = {
    ...muestra(),
    intervalo_actualizacion_segundos: 7,
    criterios_vigencia: {
      antiguedad_maxima_segundos: 5,
      precision_maxima_metros: 20,
    },
  };
  let consultas = 0;
  await page.route("**/api/v1/seguimiento/motoristas/**", (r) => {
    consultas++;
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(datos),
    });
  });
  await page.goto("/monitorear");
  await expect(page.locator("gmp-marcador-prueba")).toHaveCount(1);
  await expect(page.getByRole("status")).toContainText("cada 7 segundos");
  await expect(page.locator(".monitor-pin.antiguo")).toHaveCount(0);
  await page.clock.fastForward(4000);
  await expect(page.locator(".monitor-pin.antiguo")).toHaveCount(1);
  expect(consultas).toBe(1);
  await page.clock.fastForward(3250);
  await expect.poll(() => consultas).toBe(2);
  await expect(page.locator(".monitor-pin.antiguo")).toHaveCount(0);
});

test("reconcilia marcadores solo tras terminar todas las páginas y los retira al cerrar jornada", async ({
  page,
}) => {
  await preparar(page);
  let version = 0;
  let liberar: (() => void) | undefined;
  const consultas: URL[] = [];
  await page.route("**/api/v1/seguimiento/motoristas/**", async (r) => {
    const url = new URL(r.request().url());
    consultas.push(url);
    const datos = muestra();
    if (version === 0)
      datos.resultados.push({
        ...datos.resultados[0],
        repartidor_id: "segundo",
        nombre: "Segunda jornada",
      });
    if (version === 1) {
      if (url.searchParams.get("pagina") === "1")
        datos.pagina_siguiente = "https://no-visitar.test/?pagina=2";
      else {
        await new Promise<void>((resolve) => {
          liberar = resolve;
        });
        datos.resultados = [];
      }
    }
    if (version === 2) datos.resultados = [];
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(datos),
    });
  });
  await page.goto("/monitorear");
  await expect(page.locator("gmp-marcador-prueba")).toHaveCount(2);
  version = 1;
  await page.getByRole("button", { name: "Actualizar", exact: true }).click();
  await expect.poll(() => Boolean(liberar)).toBe(true);
  await expect(page.locator("gmp-marcador-prueba")).toHaveCount(2);
  liberar!();
  await expect(page.locator("gmp-marcador-prueba")).toHaveCount(1);
  version = 2;
  await page.getByRole("button", { name: "Actualizar", exact: true }).click();
  await expect(page.locator("gmp-marcador-prueba")).toHaveCount(0);
  await expect(page.locator(".monitor-lista > li")).toHaveCount(0);
  expect(consultas.every((u) => u.hostname === "api.vitago.test")).toBe(true);
});

for (const status of [403, 404])
  test(`HTTP ${status} informa el problema y no vuelve a consultar GPS por solicitud`, async ({
    page,
  }) => {
    await preparar(page);
    const peticiones: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("api.vitago.test"))
        peticiones.push(new URL(r.url()).pathname);
    });
    await page.route("**/api/v1/seguimiento/motoristas/**", (r) =>
      r.fulfill({ status, contentType: "application/json", body: "{}" }),
    );
    await page.goto("/monitorear");
    await expect(page.getByRole("alert")).toBeVisible();
    if (status === 404)
      await expect(
        page.getByText(
          "El seguimiento de jornada todavía no está disponible en este servidor.",
        ),
      ).toBeVisible();
    await expect(page.locator("gmp-marcador-prueba")).toHaveCount(0);
    expect(
      peticiones.some(
        (r) => r.includes("/solicitudes/") || r === "/api/v1/repartidores/",
      ),
    ).toBe(false);
  });

test("el alcance sucursal no consulta el mapa; Network global consulta sin empresa_id", async ({
  page,
}) => {
  await preparar(page);
  let global = false;
  await page.route("**/api/v1/usuarios/mi-perfil/", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...perfil,
        empresa: global ? null : perfil.empresa,
        permisos: ["repartidor.ver_ubicacion", "solicitud.ver"],
        roles: perfil.roles.map((rol) => ({
          ...rol,
          codigo: global ? "OPERADOR_RED" : rol.codigo,
          tipo_alcance: global ? "GLOBAL" : "SUCURSAL",
        })),
      }),
    }),
  );
  const consultas: URL[] = [];
  await page.route("**/api/v1/seguimiento/motoristas/**", (r) => {
    consultas.push(new URL(r.request().url()));
    const datos = muestra();
    datos.resultados[0].empresa_id = null;
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(datos),
    });
  });
  await page.goto("/monitorear");
  await expect(
    page.getByText("No tienes acceso a este módulo", { exact: true }),
  ).toBeVisible();
  expect(consultas).toHaveLength(0);
  global = true;
  await page.goto("/monitorear?empresa_id=ajena");
  await expect(page.locator("gmp-marcador-prueba")).toHaveCount(1);
  expect(consultas.every((u) => !u.searchParams.has("empresa_id"))).toBe(true);
});

test("la calidad del servidor se muestra en el listado y no inventa un marcador sin GPS", async ({
  page,
}) => {
  await preparar(page);
  let estado = "SIN_PRECISION";
  await page.route("**/api/v1/seguimiento/motoristas/**", (r) => {
    const datos = muestra();
    datos.resultados[0] = {
      ...datos.resultados[0],
      estado_ubicacion: estado,
      ubicacion_vigente: false,
      ...(estado === "SIN_UBICACION"
        ? { ubicacion: null, antiguedad_segundos: null }
        : {}),
    };
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(datos),
    });
  });
  await page.goto("/monitorear");
  await expect(page.locator(".monitor-lista")).toContainText(
    "Precisión no informada",
  );
  await expect(page.locator(".monitor-pin.antiguo")).toHaveCount(1);
  estado = "BAJA_PRECISION";
  await page.getByRole("button", { name: "Actualizar", exact: true }).click();
  await expect(page.locator(".monitor-lista")).toContainText("Baja precisión");
  estado = "SIN_UBICACION";
  await page.getByRole("button", { name: "Actualizar", exact: true }).click();
  await expect(page.locator(".monitor-lista")).toContainText(
    "Sin ubicación disponible",
  );
  await expect(page.locator("gmp-marcador-prueba")).toHaveCount(0);
});
