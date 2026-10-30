import { expect, test, type Page } from "@playwright/test";
import {
  ejemplosSeccion,
  lista,
  perfil,
  solicitud,
  sucursal,
  tokens,
} from "../fixtures";

const empresa = perfil.empresa.id;
const empresaDatos = {
  ...ejemplosSeccion("### `GET /api/v1/organizaciones/empresas/`")[0]
    .resultados[0],
  id: empresa,
};
const opcionesBase = ejemplosSeccion(
  "### `GET /api/v1/solicitudes/opciones-creacion/`",
)[0];
const servicio = ejemplosSeccion(
  "### `GET /api/v1/solicitudes/tipos-servicio/`",
)[0].resultados[0];
const tipoUbicacion = {
  id: "11111111-1111-4111-8111-111111111111",
  codigo: "SUCURSAL",
  nombre: "Sucursal",
};
const relacion = {
  id: "22222222-2222-4222-8222-222222222222",
  empresa_id: empresa,
  estado: "PENDIENTE",
  permite_origen: true,
  permite_destino: true,
  ubicacion: {
    ...sucursal.ubicacion,
    estado: "ACTIVO",
    pais: empresaDatos.pais,
    tipo_ubicacion: tipoUbicacion,
    departamento: "Francisco Morazán",
    municipio: "Distrito Central",
    ciudad: "Tegucigalpa",
    colonia: null,
    telefono: null,
    nombre_contacto: null,
    instrucciones: null,
  },
};
const permisos = [
  ...perfil.permisos,
  "empresa.ver",
  "ubicacion.ver",
  "ubicacion.crear",
  "ubicacion.aprobar",
  "vehiculo.ver",
  "vehiculo.administrar",
  "usuario.administrar",
  "rol.asignar",
  "solicitud.crear",
];
type Peticion = {
  ruta: string;
  metodo: string;
  cuerpo: any;
  query: URLSearchParams;
  bearer: string | undefined;
};
async function preparar(
  page: Page,
  {
    especial = false,
    errorCrear = false,
    restringido = false,
    errorPais = false,
  } = {},
) {
  const peticiones: Peticion[] = [];
  let ubicacion = structuredClone(relacion);
  const vehiculos: any[] = [];
  const paginar = (items: unknown[]) => ({
    conteo: items.length,
    pagina_siguiente: null,
    pagina_anterior: null,
    resultados: items,
  });
  await page.route("http://api.vitago.test/api/v1/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      ruta = url.pathname;
    let cuerpo: any = null;
    try {
      cuerpo = req.postDataJSON();
    } catch {}
    peticiones.push({
      ruta,
      metodo: req.method(),
      cuerpo,
      query: url.searchParams,
      bearer: req.headers().authorization,
    });
    const responder = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    if (ruta.endsWith("iniciar-sesion/")) return responder(tokens);
    if (ruta.endsWith("mi-perfil/"))
      return responder({
        ...perfil,
        permisos: restringido ? ["solicitud.ver"] : permisos,
      });
    if (ruta.endsWith("/repartidores/resumenes/")) return responder(lista);
    if (ruta.endsWith("/solicitudes/agrupaciones/"))
      return responder(paginar([]));
    if (ruta.endsWith("/solicitudes/opciones-creacion/"))
      return responder({
        ...opcionesBase,
        empresa_id: empresa,
        modalidad_seleccionada: url.searchParams.get("modalidad"),
        puede_crear_envio_especial: especial,
        modalidades: [
          ...opcionesBase.modalidades,
          ...(especial
            ? [
                {
                  codigo: "ESPECIAL",
                  nombre: "Envío especial",
                  requiere_destino_registrado: false,
                },
              ]
            : []),
        ],
        destinos:
          url.searchParams.get("origen_id") &&
          url.searchParams.get("modalidad") !== "ESPECIAL"
            ? opcionesBase.destinos
            : [],
      });
    if (ruta.endsWith("/tipos-servicio/"))
      return responder({ resultados: [servicio] });
    if (ruta === "/api/v1/solicitudes/" && req.method() === "POST")
      return errorCrear
        ? responder(
            {
              cantidad_tubos: ["La cantidad no está disponible."],
              cantidad_frascos: ["Revisa la cantidad de frascos."],
            },
            400,
          )
        : responder(
            {
              ...solicitud,
              cantidad_tubos: cuerpo.cantidad_tubos,
              cantidad_frascos: cuerpo.cantidad_frascos,
              articulos_historicos: [],
              estado: "ASSIGNED",
            },
            201,
          );
    if (ruta === `/api/v1/solicitudes/${solicitud.id}/`)
      return responder({ ...solicitud, cantidad_tubos: 3, estado: "ASSIGNED" });
    if (ruta.endsWith("/evidencias/")) return responder(paginar([]));
    if (ruta === "/api/v1/organizaciones/empresas/")
      return responder(paginar([empresaDatos]));
    if (ruta === `/api/v1/organizaciones/empresas/${empresa}/`)
      return errorPais
        ? responder({ detail: "Consulta temporalmente no disponible." }, 503)
        : responder(empresaDatos);
    if (ruta.endsWith("/ubicaciones/tipos/"))
      return responder({ resultados: [tipoUbicacion] });
    if (ruta === "/api/v1/ubicaciones/") {
      if (req.method() === "POST") {
        ubicacion = {
          ...ubicacion,
          estado: "PENDIENTE",
          ubicacion: { ...ubicacion.ubicacion, ...cuerpo },
        };
        return responder(ubicacion, 201);
      }
      return responder(paginar([ubicacion]));
    }
    if (ruta.includes("/autorizacion-empresa/")) {
      ubicacion = { ...ubicacion, ...cuerpo };
      return responder(ubicacion);
    }
    if (ruta === "/api/v1/vehiculos/") {
      if (req.method() === "POST") {
        const nueva = { id: "moto-nueva", ...cuerpo };
        vehiculos.push(nueva);
        return responder(nueva, 201);
      }
      return responder(paginar(vehiculos));
    }
    return responder({ detail: "Ruta fuera de la prueba." }, 404);
  });
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill("admin@example.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("solo-prueba");
  await page.getByRole("button", { name: "Entrar al panel" }).click();
  await page
    .getByRole("navigation", { name: "Navegación principal" })
    .waitFor();
  return peticiones;
}
async function completarSolicitud(page: Page, especial = false) {
  await page.goto("/solicitudes/nueva");
  await page
    .getByRole("combobox", { name: "Modalidad", exact: true })
    .selectOption(especial ? "ESPECIAL" : "ENTRE_SUCURSALES");
  await page
    .getByLabel("Sucursal de origen")
    .selectOption(opcionesBase.origenes[0].ubicacion.id);
  if (especial)
    await page
      .getByLabel("Descripción del destino especial")
      .fill("Oficinas del proveedor");
  else
    await page
      .getByRole("combobox", { name: "Destino", exact: true })
      .selectOption(opcionesBase.destinos[0].ubicacion.id);
  await page.getByLabel("Tipo de servicio").selectOption(servicio.id);
  await page.getByLabel("Cantidad de tubos").fill("3");
  await page.getByLabel("Cantidad de frascos").fill("2");
}
test("crea solicitud con catálogos autorizados, frascos y tubos independientes; muestra asignación", async ({
  page,
}) => {
  const peticiones = await preparar(page);
  await page.goto("/administracion");
  await expect(page.getByRole("link", { name: /Crear usuario/ })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Crear solicitud/ }),
  ).toBeVisible();
  await completarSolicitud(page);
  await expect(
    page
      .getByLabel("Modalidad")
      .getByRole("option", { name: "Envío especial" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Añadir artículo" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Crear solicitud", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: /El servidor ya asignó/ }),
  ).toBeVisible();
  const envios = peticiones.filter(
    (p) => p.ruta === "/api/v1/solicitudes/" && p.metodo === "POST",
  );
  expect(envios).toHaveLength(1);
  expect(envios[0].cuerpo).toMatchObject({
    empresa_id: empresa,
    cantidad_tubos: 3,
    origen_id: opcionesBase.origenes[0].ubicacion.id,
    sucursal_id: opcionesBase.origenes[0].sucursal_id,
    destino_id: opcionesBase.destinos[0].ubicacion.id,
  });
  expect(envios[0].cuerpo.cantidad_frascos).toBe(2);
  expect(envios[0].cuerpo).not.toHaveProperty("articulos");
  expect(envios[0].bearer).toBe("Bearer acceso-prueba");
});
test("conserva los datos y errores por campo de una creación rechazada sin repetir POST", async ({
  page,
}) => {
  const peticiones = await preparar(page, { errorCrear: true });
  await completarSolicitud(page);
  await page
    .getByRole("button", { name: "Crear solicitud", exact: true })
    .click();
  await expect(page.locator("#cantidad_tubos-error")).toContainText(
    "La cantidad no está disponible.",
  );
  await expect(page.locator("#cantidad_frascos-error")).toContainText(
    "Revisa la cantidad de frascos.",
  );
  await expect(page.getByLabel("Cantidad de frascos")).toHaveValue("2");
  await expect(page.getByLabel("Cantidad de tubos")).toHaveValue("3");
  expect(
    peticiones.filter(
      (p) => p.metodo === "POST" && p.ruta === "/api/v1/solicitudes/",
    ),
  ).toHaveLength(1);
});
test("envío especial utiliza descripción y destino nulo, según opciones del servidor", async ({
  page,
}) => {
  const peticiones = await preparar(page, { especial: true });
  await completarSolicitud(page, true);
  await expect(
    page.getByRole("combobox", { name: "Destino", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Crear solicitud", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/solicitudes/${solicitud.id}$`));
  expect(
    peticiones.find(
      (p) => p.metodo === "POST" && p.ruta === "/api/v1/solicitudes/",
    )?.cuerpo,
  ).toMatchObject({
    modalidad: "ESPECIAL",
    destino_id: null,
    destino_especial: "Oficinas del proveedor",
  });
});
test("cambiar modalidad descarta destino anterior y consulta opciones nuevas", async ({
  page,
}) => {
  const peticiones = await preparar(page);
  await completarSolicitud(page);
  await page
    .getByRole("combobox", { name: "Modalidad", exact: true })
    .selectOption("EMPRESA_TRANSPORTE");
  await expect(page.getByLabel("Sucursal de origen")).toHaveValue("");
  await expect(
    page.getByRole("combobox", { name: "Destino", exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByRole("combobox", { name: "Destino", exact: true }),
  ).toBeDisabled();
  await expect
    .poll(() =>
      peticiones.some(
        (p) =>
          p.query.get("modalidad") === "EMPRESA_TRANSPORTE" &&
          !p.query.has("origen_id"),
      ),
    )
    .toBe(true);
  expect(
    peticiones.filter(
      (p) => p.metodo === "POST" && p.ruta === "/api/v1/solicitudes/",
    ),
  ).toHaveLength(0);
});
test("registra ubicación y aprueba su relación con los identificadores correctos", async ({
  page,
}) => {
  const peticiones = await preparar(page);
  await page.goto("/ubicaciones?crear=1");
  await page.getByLabel("Nombre de ubicación").fill("Clínica Norte");
  await page.getByLabel("Tipo de ubicación").selectOption(tipoUbicacion.id);
  await page.getByLabel("Dirección", { exact: true }).fill("Avenida principal");
  await page
    .getByLabel("Departamento", { exact: true })
    .fill("Francisco Morazán");
  await page.getByLabel("Latitud", { exact: true }).fill("14.072300");
  await page.getByLabel("Longitud", { exact: true }).fill("-87.192100");
  await page
    .getByRole("button", { name: "Registrar ubicación", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: /Ubicación registrada/ }),
  ).toBeVisible();
  const envio = peticiones.find(
    (p) => p.metodo === "POST" && p.ruta === "/api/v1/ubicaciones/",
  );
  expect(envio?.cuerpo).toMatchObject({
    pais_id: empresaDatos.pais.id,
    empresa_id: empresa,
    origen: "REGISTRADA_USUARIO",
    latitud: "14.072300",
    longitud: "-87.192100",
  });
  expect(envio?.cuerpo).not.toHaveProperty("identificador_lugar_google");
  await page.getByRole("button", { name: "Gestionar autorización" }).click();
  await page.getByLabel("Estado de autorización").selectOption("APROBADO");
  await page.getByLabel("Permitir como destino").uncheck();
  await page.getByRole("button", { name: "Guardar autorización" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: /Autorización de ubicación actualizada/ }),
  ).toBeVisible();
  expect(peticiones.find((p) => p.metodo === "PATCH")?.ruta).toBe(
    `/api/v1/ubicaciones/${relacion.ubicacion.id}/autorizacion-empresa/${empresa}/`,
  );
  expect(peticiones.find((p) => p.metodo === "PATCH")?.cuerpo).toEqual({
    estado: "APROBADO",
    permite_origen: true,
    permite_destino: false,
  });
});
test("consulta empresas y registra motocicletas desde su módulo", async ({
  page,
}) => {
  const peticiones = await preparar(page);
  await page.goto("/empresas");
  await expect(
    page
      .getByRole("region", { name: "Empresas", exact: true })
      .getByText(empresaDatos.nombre, { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("region", { name: "Empresas", exact: true })
    .getByRole("link", { name: "Vehículos", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Registrar motocicleta", exact: true })
    .click();
  await page.getByLabel("Placa", { exact: true }).fill("HBA-2026");
  await page.getByLabel("Marca", { exact: true }).fill("Honda");
  await page.getByLabel("Estado del vehículo").selectOption("MANTENIMIENTO");
  await page
    .getByRole("button", { name: "Registrar motocicleta", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: /Motocicleta registrada/ }),
  ).toBeVisible();
  expect(
    peticiones.find(
      (p) => p.metodo === "POST" && p.ruta === "/api/v1/vehiculos/",
    )?.cuerpo,
  ).toMatchObject({
    empresa_id: empresa,
    tipo: "MOTOCICLETA",
    estado: "MANTENIMIENTO",
  });
  await expect(
    page
      .getByRole("region", { name: "Vehículos", exact: true })
      .getByText("HBA-2026"),
  ).toBeVisible();
});
test("reintentar una consulta de país no envía un formulario de ubicación ya completo", async ({
  page,
}) => {
  const peticiones = await preparar(page, { errorPais: true });
  await page.goto("/ubicaciones?crear=1");
  await page.getByLabel("ID del país autorizado").fill(empresaDatos.pais.id);
  await page.getByLabel("Nombre de ubicación").fill("Clínica Norte");
  await page.getByLabel("Tipo de ubicación").selectOption(tipoUbicacion.id);
  await page.getByLabel("Dirección", { exact: true }).fill("Avenida principal");
  await page.getByLabel("Latitud", { exact: true }).fill("14.072300");
  await page.getByLabel("Longitud", { exact: true }).fill("-87.192100");
  await page.getByRole("button", { name: "Volver a intentar" }).click();
  await expect
    .poll(
      () =>
        peticiones.filter(
          (p) => p.ruta === `/api/v1/organizaciones/empresas/${empresa}/`,
        ).length,
    )
    .toBe(2);
  expect(
    peticiones.filter(
      (p) => p.metodo === "POST" && p.ruta === "/api/v1/ubicaciones/",
    ),
  ).toHaveLength(0);
});
test("permisos parciales impiden altas incluso mediante enlace directo", async ({
  page,
}) => {
  const peticiones = await preparar(page, { restringido: true });
  await page.goto("/administracion");
  await expect(
    page.getByRole("link", {
      name: /Crear usuario|Crear solicitud|Crear ubicación|Registrar motocicleta/,
    }),
  ).toHaveCount(0);
  for (const ruta of [
    "/solicitudes/nueva",
    "/ubicaciones?crear=1",
    "/vehiculos?crear=1",
    "/usuarios/nuevo",
  ]) {
    await page.goto(ruta);
    await expect(
      page.getByRole("heading", { name: "No tienes acceso a este módulo" }),
    ).toBeVisible();
  }
  expect(
    peticiones.filter(
      (p) => p.metodo === "POST" && !p.ruta.endsWith("iniciar-sesion/"),
    ),
  ).toHaveLength(0);
});
test("administración y alta de solicitudes se adaptan a escritorio, tablet y teléfono", async ({
  page,
}) => {
  await preparar(page);
  await page.goto("/administracion");
  await page.screenshot({
    path: "artifacts/administracion-escritorio.png",
    fullPage: true,
  });
  await completarSolicitud(page);
  for (const width of [1440, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.screenshot({
      path: `artifacts/crear-solicitud-${width}.png`,
      fullPage: true,
    });
  }
});
