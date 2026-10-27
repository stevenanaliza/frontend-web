import { expect, test, type Page } from "@playwright/test";
import {
  perfil,
  tokens,
  usuario,
  motorista,
  sucursal,
  solicitud,
  historialRoles,
  lista,
} from "../fixtures";

const perfilGestion = {
  ...perfil,
  permisos: [
    ...perfil.permisos,
    "rol.asignar",
    "usuario.administrar",
    "ubicacion.ver",
    "vehiculo.ver",
    "vehiculo.administrar",
    "solicitud.reasignar",
    "solicitud.cancelar",
  ],
};
const empresa = perfilGestion.empresa.id;
const rol = {
  ...historialRoles.resultados[0].rol,
  codigo: "SOLICITANTE_CORPORATIVO",
  nombre: "Solicitante corporativo",
};
const usuarioMotorista = {
  ...usuario,
  empresa_id: empresa,
  roles: [
    {
      codigo: "REPARTIDOR_CORPORATIVO",
      nombre: "Motorista corporativo",
      tipo_alcance: "EMPRESA",
      empresa_id: empresa,
      sucursal_id: null,
    },
  ],
};
const moto = { ...motorista.vehiculo, empresa_id: empresa };
const disponible = {
  ...motorista,
  empresa_id: solicitud.empresa_id,
  estado_operativo: "AVAILABLE",
  puede_recibir_solicitudes: true,
  tubos_disponibles: 20,
};
type Peticion = {
  ruta: string;
  metodo: string;
  cuerpo: any;
  query: URLSearchParams;
};
async function preparar(
  page: Page,
  opciones: {
    errorPassword?: boolean;
    errorAsignar?: boolean;
    sinPermisos?: boolean;
  } = {},
) {
  const peticiones: Peticion[] = [];
  const roles = structuredClone(historialRoles);
  let detalle = {
    ...solicitud,
    estado: "PENDING",
    repartidor_asignado_id: null,
    cantidad_tubos: 3,
  };
  let creada = false;
  const pagina = (resultados: unknown[]) => ({
    conteo: resultados.length,
    pagina_siguiente: null,
    pagina_anterior: null,
    resultados,
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
    });
    const responder = (datos: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(datos),
      });
    if (ruta.endsWith("iniciar-sesion/")) return responder(tokens);
    if (ruta.endsWith("mi-perfil/"))
      return responder(opciones.sinPermisos ? perfil : perfilGestion);
    if (ruta.endsWith("/repartidores/resumenes/")) return responder(lista);
    if (ruta.endsWith("cerrar-todas-las-sesiones/"))
      return route.fulfill({ status: 204 });
    if (ruta === "/api/v1/usuarios/roles-asignables/")
      return responder({ resultados: [rol] });
    if (ruta === "/api/v1/usuarios/") {
      if (req.method() === "POST") {
        creada = true;
        return responder(
          {
            ...usuario,
            ...cuerpo,
            roles: [{ ...rol, ...cuerpo }],
            creado_en: usuario.creado_en,
          },
          201,
        );
      }
      return responder(pagina([usuarioMotorista]));
    }
    if (ruta === `/api/v1/usuarios/${usuario.id}/`)
      return responder({
        ...usuario,
        empresa_id: empresa,
        roles: creada
          ? [
              {
                ...rol,
                tipo_alcance: "EMPRESA",
                empresa_id: empresa,
                sucursal_id: null,
              },
            ]
          : usuario.roles,
      });
    if (ruta === `/api/v1/usuarios/${usuario.id}/roles/`) {
      if (req.method() === "POST") {
        const asignada = {
          ...roles.resultados[0],
          id: "22222222-1111-4111-8111-111111111111",
          rol,
          ...cuerpo,
        };
        roles.resultados.push(asignada);
        return responder(asignada, 201);
      }
      return responder(roles);
    }
    if (ruta.includes("/roles/") && req.method() === "DELETE") {
      roles.resultados[0].activo = false;
      roles.resultados[0].revocado_en = "2026-10-27T18:00:00Z";
      return route.fulfill({ status: 204 });
    }
    if (ruta.endsWith("/restablecer-contrasena/"))
      return opciones.errorPassword
        ? responder(
            { contrasena_temporal: ["La contraseña es demasiado común."] },
            400,
          )
        : route.fulfill({ status: 204 });
    if (ruta === "/api/v1/ubicaciones/")
      return responder(
        pagina([
          {
            id: "11111111-1111-4111-8111-111111111112",
            empresa_id: empresa,
            estado: "APROBADO",
            permite_origen: true,
            permite_destino: true,
            ubicacion: { ...sucursal.ubicacion, estado: "ACTIVO" },
          },
        ]),
      );
    if (ruta.includes("/sucursales/"))
      return req.method() === "POST"
        ? responder({ ...sucursal, ...cuerpo, empresa_id: empresa }, 201)
        : responder(pagina([{ ...sucursal, empresa_id: empresa }]));
    if (ruta === "/api/v1/vehiculos/")
      return req.method() === "POST"
        ? responder({ ...moto, ...cuerpo }, 201)
        : responder(pagina([moto]));
    if (ruta === "/api/v1/repartidores/")
      return req.method() === "POST"
        ? responder({ ...motorista, ...cuerpo }, 201)
        : responder(pagina([motorista]));
    if (ruta === "/api/v1/repartidores/disponibles/")
      return responder(pagina([disponible]));
    if (ruta === `/api/v1/solicitudes/${solicitud.id}/`)
      return responder(detalle);
    if (ruta.endsWith("/asignaciones/")) {
      if (opciones.errorAsignar)
        return responder(
          { repartidor_id: ["El motorista ya no dispone de cupo."] },
          409,
        );
      detalle = {
        ...detalle,
        repartidor_asignado_id: cuerpo.repartidor_id,
        estado: "ASSIGNED",
      };
      return responder(detalle, 201);
    }
    if (ruta.endsWith("/cantidad-tubos/")) {
      detalle = { ...detalle, cantidad_tubos: cuerpo.cantidad_tubos };
      return responder(detalle);
    }
    if (ruta.endsWith("/transiciones/")) {
      detalle = { ...detalle, estado: "CANCELLED" };
      return responder(detalle);
    }
    if (ruta.endsWith("/evidencias/")) return responder(pagina([]));
    return responder({ detail: "Ruta fuera de la prueba." }, 404);
  });
  return peticiones;
}
async function entrar(page: Page) {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill("admin@example.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("solo-prueba");
  await page.getByRole("button", { name: "Entrar al panel" }).click();
  await expect(
    page.getByRole("heading", { name: "Resúmenes diarios", exact: true }),
  ).toBeVisible();
}
test("alta de usuario usa catálogo delegado, alcance y contraseña sin repetir POST", async ({
  page,
}) => {
  const peticiones = await preparar(page);
  await entrar(page);
  await page.goto("/usuarios/nuevo");
  await page.getByLabel("Correo electrónico").fill("nuevo@example.test");
  await page.getByLabel("Nombres", { exact: true }).fill("Nueva");
  await page.getByLabel("Apellidos", { exact: true }).fill("Persona");
  await page
    .getByLabel("Contraseña temporal", { exact: true })
    .fill("Temporal-prueba-2026!");
  await page
    .getByLabel("Confirmar contraseña temporal", { exact: true })
    .fill("Temporal-prueba-2026!");
  await page.getByLabel("Rol autorizado").selectOption(rol.codigo);
  await page
    .getByRole("button", { name: "Crear usuario", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/usuarios/${usuario.id}$`));
  expect(
    peticiones.filter(
      (p) => p.ruta === "/api/v1/usuarios/" && p.metodo === "POST",
    ),
  ).toHaveLength(1);
  const creacion = peticiones.find(
    (p) => p.ruta === "/api/v1/usuarios/" && p.metodo === "POST",
  )!;
  expect(creacion.cuerpo.rol_codigo).toBe(rol.codigo);
  expect(creacion.cuerpo.empresa_id).toBe(empresa);
  expect(creacion.cuerpo).not.toHaveProperty("confirmacion");
});
test("asigna y revoca roles con confirmación y conserva historial", async ({
  page,
}) => {
  const peticiones = await preparar(page);
  await entrar(page);
  await page.goto(`/usuarios/${usuario.id}`);
  await page.getByRole("button", { name: "Asignar rol", exact: true }).click();
  await page.getByLabel("Rol autorizado").selectOption(rol.codigo);
  await page
    .getByRole("region", { name: "Asignar rol", exact: true })
    .getByRole("button", { name: "Asignar rol", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Rol asignado" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Revocar Solicitante externo/ })
    .click();
  await page.getByLabel("Confirmo la revocación de este rol.").check();
  await page.getByRole("button", { name: "Confirmar revocación" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Rol revocado" }),
  ).toBeVisible();
  expect(peticiones.filter((p) => p.metodo === "DELETE")).toHaveLength(1);
});
test("restablece contraseña usando endpoint documentado y no envía confirmación local", async ({
  page,
}) => {
  const peticiones = await preparar(page);
  await entrar(page);
  await page.goto(`/usuarios/${usuario.id}`);
  await page
    .getByRole("button", { name: "Restablecer contraseña", exact: true })
    .click();
  await page
    .getByLabel("Nueva contraseña", { exact: true })
    .fill("Nueva-segura-prueba-2026!");
  await page
    .getByLabel("Confirmar nueva contraseña", { exact: true })
    .fill("Nueva-segura-prueba-2026!");
  await page
    .getByRole("button", { name: "Confirmar nueva contraseña", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Contraseña restablecida" }),
  ).toBeVisible();
  const cambios = peticiones.filter((p) =>
    p.ruta.endsWith("/restablecer-contrasena/"),
  );
  expect(cambios).toHaveLength(1);
  expect(Object.keys(cambios[0].cuerpo)).toEqual(["contrasena_temporal"]);
});
test("conserva el formulario y la validación de contraseña del backend", async ({
  page,
}) => {
  const peticiones = await preparar(page, { errorPassword: true });
  await entrar(page);
  await page.goto(`/usuarios/${usuario.id}`);
  await page
    .getByRole("button", { name: "Restablecer contraseña", exact: true })
    .click();
  await page.getByLabel("Nueva contraseña", { exact: true }).fill("comun");
  await page
    .getByLabel("Confirmar nueva contraseña", { exact: true })
    .fill("comun");
  await page
    .getByRole("button", { name: "Confirmar nueva contraseña", exact: true })
    .click();
  await expect(page.locator("#contrasena_temporal-error")).toContainText(
    "demasiado común",
  );
  expect(
    peticiones.filter((p) => p.ruta.endsWith("/restablecer-contrasena/")),
  ).toHaveLength(1);
});
test("alta de sucursal envía el ID de ubicación, no el de la relación", async ({
  page,
}) => {
  const peticiones = await preparar(page);
  await entrar(page);
  await page.goto("/sucursales");
  await page
    .getByRole("button", { name: "Crear sucursal", exact: true })
    .click();
  await page.getByLabel("Nombre de la sucursal").fill("Sede nueva");
  await page.getByLabel("Código de sucursal").fill("NVA-01");
  await page
    .getByRole("radio", { name: new RegExp(sucursal.ubicacion.nombre) })
    .check();
  await page
    .getByRole("region", { name: "Crear sucursal", exact: true })
    .getByRole("button", { name: "Crear sucursal", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Sucursal creada" }),
  ).toBeVisible();
  expect(
    peticiones.find(
      (p) => p.metodo === "POST" && p.ruta.includes("/sucursales/"),
    )?.cuerpo.ubicacion_id,
  ).toBe(sucursal.ubicacion.id);
});
test("alta de motorista selecciona usuario con rol y motocicleta de su empresa", async ({
  page,
}) => {
  const peticiones = await preparar(page);
  await entrar(page);
  await page.goto("/motoristas");
  await page
    .getByRole("button", { name: "Crear motorista", exact: true })
    .click();
  await page.getByRole("radio", { name: new RegExp(usuario.correo) }).check();
  await page.getByRole("radio", { name: new RegExp(moto.placa) }).check();
  await page
    .getByRole("region", { name: "Crear perfil de motorista" })
    .getByRole("button", { name: "Crear motorista", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Perfil de motorista creado" }),
  ).toBeVisible();
  expect(
    peticiones.find(
      (p) => p.metodo === "POST" && p.ruta === "/api/v1/repartidores/",
    )?.cuerpo,
  ).toEqual({
    empresa_id: empresa,
    usuario_id: usuario.id,
    vehiculo_id: moto.id,
  });
});
test("asigna motorista por perfil y filtra disponibles por tubos; corrige y cancela", async ({
  page,
}) => {
  const peticiones = await preparar(page);
  await entrar(page);
  await page.goto(`/solicitudes/${solicitud.id}`);
  await page
    .getByRole("button", { name: "Asignar motorista", exact: true })
    .click();
  await page.getByRole("radio", { name: /tubos disponibles/ }).check();
  await page
    .getByLabel("Motivo", { exact: true })
    .fill("Asignación confirmada");
  await page.getByRole("button", { name: "Confirmar asignación" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Solicitud actualizada" }),
  ).toBeVisible();
  expect(
    peticiones
      .find((p) => p.ruta.endsWith("/disponibles/"))
      ?.query.get("cantidad_tubos"),
  ).toBe("3");
  expect(
    peticiones.find((p) => p.ruta.endsWith("/asignaciones/"))?.cuerpo
      .repartidor_id,
  ).toBe(motorista.id);
  await page
    .getByRole("button", { name: "Corregir cantidad de tubos" })
    .click();
  await page.getByLabel("Cantidad de tubos", { exact: true }).fill("4");
  await page.getByLabel("Motivo", { exact: true }).fill("Conteo confirmado");
  await page.getByRole("button", { name: "Guardar cantidad de tubos" }).click();
  await expect(
    page.getByRole("region", { name: "Información de la solicitud" }),
  ).toContainText("4");
  await page
    .getByRole("button", { name: "Cancelar solicitud", exact: true })
    .click();
  await page.getByLabel("Motivo", { exact: true }).fill("Servicio retirado");
  await page
    .getByLabel(new RegExp("Confirmo la cancelación de la solicitud"))
    .check();
  await page.getByRole("button", { name: "Confirmar cancelación" }).click();
  await expect(
    page.getByRole("region", { name: "Información de la solicitud" }),
  ).toContainText("Cancelada");
  expect(
    peticiones.filter((p) => p.ruta.endsWith("/transiciones/")),
  ).toHaveLength(1);
});
test("un 409 de asignación conserva motivo y no repite la operación", async ({
  page,
}) => {
  const peticiones = await preparar(page, { errorAsignar: true });
  await entrar(page);
  await page.goto(`/solicitudes/${solicitud.id}`);
  await page
    .getByRole("button", { name: "Asignar motorista", exact: true })
    .click();
  await page.getByRole("radio", { name: /tubos disponibles/ }).check();
  await page
    .getByLabel("Motivo", { exact: true })
    .fill("Reasignación revisada");
  await page.getByRole("button", { name: "Confirmar asignación" }).click();
  await expect(page.locator("#repartidor_id-error")).toContainText(
    "ya no dispone de cupo",
  );
  await expect(page.getByLabel("Motivo", { exact: true })).toHaveValue(
    "Reasignación revisada",
  );
  expect(
    peticiones.filter((p) => p.ruta.endsWith("/asignaciones/")),
  ).toHaveLength(1);
});
test("sin permisos no expone altas ni gestión de roles o contraseñas", async ({
  page,
}) => {
  const peticiones = await preparar(page, { sinPermisos: true });
  await entrar(page);
  await page.goto("/usuarios/nuevo");
  await expect(
    page.getByRole("heading", { name: "No tienes acceso a este módulo" }),
  ).toBeVisible();
  await page.goto(`/usuarios/${usuario.id}`);
  await expect(
    page.getByRole("button", { name: "Restablecer contraseña", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Asignar rol", exact: true }),
  ).toHaveCount(0);
  expect(
    peticiones.filter(
      (p) => p.metodo === "POST" && !p.ruta.endsWith("iniciar-sesion/"),
    ),
  ).toHaveLength(0);
});
test("capturas de altas y contraseña en escritorio y tablet", async ({
  page,
}) => {
  await preparar(page);
  await entrar(page);
  await page.goto("/usuarios/nuevo");
  await expect(page.getByLabel("Rol autorizado")).toBeVisible();
  await page.screenshot({
    path: "artifacts/alta-usuario-escritorio.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 768, height: 1024 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: "artifacts/alta-usuario-tablet.png",
    fullPage: true,
  });
  await page.goto("/mi-cuenta");
  await page
    .getByRole("button", { name: "Cambiar mi contraseña", exact: true })
    .click();
  await expect(
    page.getByLabel("Nueva contraseña", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/mi-cuenta-tablet.png",
    fullPage: true,
  });
});
