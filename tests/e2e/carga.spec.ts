import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import {
  ejemplosSeccion,
  lista,
  motorista,
  perfil,
  resumen,
  solicitud,
  tokens,
} from "../fixtures";

const opciones = ejemplosSeccion(
  "### `GET /api/v1/solicitudes/opciones-creacion/`",
)[0];
const servicio = ejemplosSeccion(
  "### `GET /api/v1/solicitudes/tipos-servicio/`",
)[0].resultados[0];
const historico = {
  id: "historia",
  tipo_articulo: "Contenido anterior",
  descripcion: "Solo historia",
  cantidad: "12.50",
  codigo_referencia: "HIST-044",
  condicion_transporte: "Refrigerado",
  notas: "Registro previo",
};
const temporal = {
  codigo: "CIERRE_OPERATIVO_PENDIENTE",
  detail:
    "El servidor está recuperando el cierre operativo. Intente nuevamente en unos segundos.",
};
type Peticion = { ruta: string; metodo: string; cuerpo: any };
async function preparar(
  page: Page,
  { estado = "PENDING", desconocido = false, fallo = "", errorCarga = 0 } = {},
) {
  const control = { fallo, errorCarga };
  const peticiones: Peticion[] = [];
  let detalle = {
    ...solicitud,
    estado,
    cantidad_tubos: 8,
    cantidad_frascos: desconocido ? null : 3,
    articulos_historicos: [historico],
  };
  const actividad = {
    ...resumen,
    frascos: {
      recogidos_conocidos: 9,
      entregados_conocidos: 7,
      recolecciones_sin_cantidad: 2,
      entregas_sin_cantidad: 1,
    },
    carga_actual: { ...resumen.carga_actual, ...motorista },
  };
  const paginar = (resultados: unknown[]) => ({
    conteo: resultados.length,
    pagina_siguiente: null,
    pagina_anterior: null,
    resultados,
  });
  await page.route("http://api.vitago.test/api/v1/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      ruta = url.pathname;
    let cuerpo = null;
    try {
      cuerpo = req.postDataJSON();
    } catch {
      /* GET */
    }
    peticiones.push({ ruta, metodo: req.method(), cuerpo });
    const responder = (datos: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(datos),
        headers: status === 503 ? { "Retry-After": "5" } : {},
      });
    if (
      (control.fallo === "login" && ruta.endsWith("iniciar-sesion/")) ||
      (control.fallo === "perfil" && ruta.endsWith("mi-perfil/")) ||
      (control.fallo === "resumen" && ruta.endsWith("/resumenes/")) ||
      (control.fallo === "carga" && ruta.endsWith("/carga/"))
    )
      return responder(temporal, 503);
    if (ruta.endsWith("iniciar-sesion/")) return responder(tokens);
    if (ruta.endsWith("mi-perfil/"))
      return responder({
        ...perfil,
        permisos: [
          ...perfil.permisos,
          "solicitud.crear",
          "empresa.ver",
          "empresa.administrar",
        ],
      });
    if (ruta.endsWith("/repartidores/resumenes/"))
      return responder({ ...lista, resultados: [actividad] });
    if (ruta.endsWith("/resumen/")) return responder(actividad);
    if (ruta.endsWith("/temperaturas/")) return responder(paginar([]));
    if (ruta === "/api/v1/repartidores/")
      return responder(paginar([motorista]));
    if (ruta.endsWith("/opciones-creacion/"))
      return responder({
        ...opciones,
        modalidad_seleccionada: url.searchParams.get("modalidad"),
      });
    if (ruta.endsWith("/tipos-servicio/"))
      return responder({ resultados: [servicio] });
    if (ruta === "/api/v1/solicitudes/" && req.method() === "POST") {
      detalle = { ...detalle, ...cuerpo, articulos_historicos: [] };
      return responder(detalle, 201);
    }
    if (ruta.endsWith("/carga/")) {
      if (control.errorCarga)
        return responder(
          {
            cantidad_frascos: [
              "La modificación supera el cupo de frascos del motorista.",
            ],
          },
          control.errorCarga,
        );
      detalle = { ...detalle, ...cuerpo };
      return responder(detalle);
    }
    if (ruta === `/api/v1/solicitudes/${solicitud.id}/`)
      return responder(detalle);
    if (ruta.endsWith("/evidencias/")) return responder(paginar([]));
    if (ruta.endsWith("/limites-motoristas/"))
      return responder({
        alcance: "EMPRESA",
        empresa_id: perfil.empresa.id,
        limite_tubos: 20,
        limite_frascos: 12,
        limite_solicitudes: 5,
      });
    return responder({ detail: "Fuera de la prueba" }, 404);
  });
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill("prueba@example.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("prueba");
  await page.getByRole("button", { name: "Entrar al panel" }).click();
  if (!["login", "perfil"].includes(fallo))
    await expect(
      page.getByRole("navigation", { name: "Navegación principal" }),
    ).toBeVisible();
  return { control, peticiones };
}
async function alta(page: Page) {
  await page.goto("/solicitudes/nueva");
  await page
    .getByRole("combobox", { name: "Modalidad", exact: true })
    .selectOption("ENTRE_SUCURSALES");
  await page
    .getByLabel("Sucursal de origen")
    .selectOption(opciones.origenes[0].ubicacion.id);
  await page
    .getByRole("combobox", { name: "Destino", exact: true })
    .selectOption(opciones.destinos[0].ubicacion.id);
  await page.getByLabel("Tipo de servicio").selectOption(servicio.id);
}

for (const [tubos, frascos] of [
  [0, 3],
  [8, 0],
])
  test(`alta con ${tubos} tubos y ${frascos} frascos valida la carga vacía y no envía artículos`, async ({
    page,
  }) => {
    const { peticiones } = await preparar(page);
    await alta(page);
    const guardar = page.getByRole("button", {
      name: "Crear solicitud",
      exact: true,
    });
    await guardar.click();
    await expect(page.locator("#cantidad_frascos-error")).toContainText(
      "al menos un tubo o un frasco",
    );
    expect(
      peticiones.filter(
        (p) => p.ruta === "/api/v1/solicitudes/" && p.metodo === "POST",
      ),
    ).toHaveLength(0);
    await page.getByLabel("Cantidad de tubos").fill(String(tubos));
    await page.getByLabel("Cantidad de frascos").fill(String(frascos));
    await guardar.click();
    await expect(page).toHaveURL(new RegExp(`/solicitudes/${solicitud.id}$`));
    const envios = peticiones.filter(
      (p) => p.ruta === "/api/v1/solicitudes/" && p.metodo === "POST",
    );
    expect(envios).toHaveLength(1);
    expect(envios[0].cuerpo).toMatchObject({
      cantidad_tubos: tubos,
      cantidad_frascos: frascos,
    });
    expect(envios[0].cuerpo).not.toHaveProperty("articulos");
  });

test("regulariza frascos históricos recogidos conservando los tubos conocidos", async ({
  page,
}) => {
  const { peticiones } = await preparar(page, {
    estado: "IN_TRANSIT",
    desconocido: true,
  });
  await page.goto(`/solicitudes/${solicitud.id}`);
  await expect(
    page.getByRole("region", { name: "Información de la solicitud" }),
  ).toContainText("No registrado");
  await expect(
    page
      .getByRole("region", { name: "Artículos históricos", exact: true })
      .first(),
  ).toContainText("HIST-044");
  await page.getByRole("button", { name: "Completar carga" }).click();
  await expect(
    page.getByRole("spinbutton", { name: /^Cantidad de tubos/ }),
  ).toHaveCount(0);
  await page
    .getByRole("spinbutton", { name: /^Cantidad de frascos/ })
    .fill("2");
  await page.getByLabel("Motivo", { exact: true }).fill("Conteo confirmado");
  await page.getByRole("button", { name: "Guardar carga" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Solicitud actualizada" }),
  ).toBeVisible();
  expect(peticiones.find((p) => p.metodo === "PATCH")?.cuerpo).toEqual({
    cantidad_frascos: 2,
    motivo: "Conteo confirmado",
  });
  expect(peticiones.find((p) => p.metodo === "PATCH")?.ruta).toBe(
    `/api/v1/solicitudes/${solicitud.id}/carga/`,
  );
  await expect(
    page.getByRole("button", { name: /Completar carga|Corregir carga/ }),
  ).toHaveCount(0);
});
for (const status of [400, 409])
  test(`corrección HTTP ${status} conserva campos y muestra el error de frascos`, async ({
    page,
  }) => {
    const { peticiones } = await preparar(page, { errorCarga: status });
    await page.goto(`/solicitudes/${solicitud.id}`);
    await page.getByRole("button", { name: "Corregir carga" }).click();
    await page
      .getByRole("spinbutton", { name: /^Cantidad de tubos/ })
      .fill("0");
    await page
      .getByRole("spinbutton", { name: /^Cantidad de frascos/ })
      .fill("4");
    await page.getByLabel("Motivo", { exact: true }).fill("Conteo revisado");
    await page.getByRole("button", { name: "Guardar carga" }).click();
    await expect(page.locator("#cantidad_frascos-error")).toContainText(
      "cupo de frascos",
    );
    await expect(
      page.getByRole("spinbutton", { name: /^Cantidad de frascos/ }),
    ).toHaveValue("4");
    await expect(page.getByLabel("Motivo", { exact: true })).toHaveValue(
      "Conteo revisado",
    );
    expect(peticiones.filter((p) => p.metodo === "PATCH")).toHaveLength(1);
  });
test("una terminal conserva null e historia sin ofrecer correcciones", async ({
  page,
}) => {
  const { peticiones } = await preparar(page, {
    estado: "DELIVERED",
    desconocido: true,
  });
  await page.goto(`/solicitudes/${solicitud.id}`);
  await expect(
    page.getByRole("region", { name: "Información de la solicitud" }),
  ).toContainText("No registrado");
  await expect(
    page.getByRole("button", {
      name: /Completar carga|Corregir carga|Asignar motorista/,
    }),
  ).toHaveCount(0);
  expect(peticiones.some((p) => p.metodo === "PATCH")).toBe(false);
});

for (const fallo of ["login", "perfil", "resumen", "carga"])
  test(`503 en ${fallo} respeta Retry-After y solo reintenta por acción del usuario`, async ({
    page,
  }) => {
    await page.clock.install();
    const { control, peticiones } = await preparar(page, {
      fallo: fallo === "carga" ? "" : fallo,
    });
    let boton = page.getByRole("button", { name: "Entrar al panel" });
    if (fallo === "perfil")
      boton = page.getByRole("button", { name: "Reintentar perfil" });
    if (fallo === "resumen")
      boton = page.getByRole("button", { name: "Volver a intentar" });
    if (fallo === "carga") {
      await page.goto(`/solicitudes/${solicitud.id}`);
      await page.getByRole("button", { name: "Corregir carga" }).click();
      await page.getByLabel("Motivo", { exact: true }).fill("Conteo revisado");
      control.fallo = "carga";
      await page.getByRole("button", { name: "Guardar carga" }).click();
    }
    await expect(page.getByRole("alert")).toContainText(
      "recuperando el cierre operativo",
    );
    if (["login", "carga"].includes(fallo))
      boton = page.getByRole("button", { name: /Intenta de nuevo en/ });
    await expect(boton).toBeDisabled();
    const antes = peticiones.length;
    await page.clock.fastForward(4000);
    await expect(boton).toBeDisabled();
    expect(peticiones).toHaveLength(antes);
    control.fallo = "";
    await page.clock.fastForward(1250);
    expect(peticiones).toHaveLength(antes);
    if (["login", "carga"].includes(fallo))
      boton = page.getByRole("button", {
        name: fallo === "login" ? "Entrar al panel" : "Guardar carga",
        exact: true,
      });
    await expect(boton).toBeEnabled();
    await boton.click();
    if (fallo === "carga")
      await expect(
        page.getByRole("status").filter({ hasText: "Solicitud actualizada" }),
      ).toBeVisible();
    else
      await expect(
        page.getByRole("heading", { name: "Resúmenes diarios", exact: true }),
      ).toBeVisible();
    expect(
      peticiones.filter((p) => p.ruta.endsWith("iniciar-sesion/")),
    ).toHaveLength(fallo === "login" ? 2 : 1);
  });

test("resúmenes, límites y alta con frascos se adaptan a teléfono, tablet y escritorio", async ({
  page,
}) => {
  await preparar(page);
  mkdirSync("artifacts/carga", { recursive: true });
  for (const width of [320, 820, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [nombre, ruta, texto] of [
      ["alta", "/solicitudes/nueva", "Datos del traslado"],
      ["limites", "/limites-motoristas", "Configuración de la empresa"],
      [
        "resumen",
        `/motoristas/${resumen.repartidor.id}`,
        "Frascos recogidos conocidos",
      ],
      ["directorio", "/motoristas", "Directorio de motoristas"],
    ]) {
      await page.goto(ruta);
      await expect(
        page.getByText(texto, { exact: true }).first(),
      ).toBeVisible();
      if (nombre === "resumen")
        await expect(
          page.getByText("2 recolecciones sin cantidad registrada"),
        ).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `artifacts/carga/${nombre}-${width}.png`,
        fullPage: true,
      });
    }
  }
});
