import { expect, type Page } from "@playwright/test";
import {
  ejemplosSeccion,
  lista,
  motorista,
  perfil,
  solicitud,
  tokens,
} from "../fixtures";

const ejemploGps = ejemplosSeccion("## 0.45.0 — Ubicación administrativa")[0];
const sinCarga = {
  solicitudes_activas: 0,
  tubos_en_transporte: 0,
  tubos_reservados: 0,
  tubos_comprometidos: 0,
  tubos_disponibles: 20,
  capacidad: "EMPTY",
};
const segundaMoto = {
  ...motorista,
  estado_operativo: "ON_ROUTE",
  capacidad: "AVAILABLE_SPACE",
  solicitudes_activas: 1,
  tubos_en_transporte: 3,
  tubos_reservados: 0,
  tubos_comprometidos: 3,
  tubos_disponibles: 17,
  puede_recibir_solicitudes: true,
  id: "11111111-1111-4111-8111-111111111111",
  usuario: { ...motorista.usuario, nombres: "Elena", apellidos: "De prueba" },
};
const sinGps = {
  ...motorista,
  ...sinCarga,
  id: "22222222-2222-4222-8222-222222222222",
  estado_operativo: "OFFLINE",
  usuario: {
    ...motorista.usuario,
    nombres: "Sin señal",
    apellidos: "De prueba",
  },
};
const primera = {
  ...solicitud,
  estado: "IN_TRANSIT",
  cantidad_tubos: 3,
  cantidad_frascos: 2,
  repartidor_asignado_id: motorista.id,
};
const segunda = {
  ...primera,
  id: "33333333-3333-4333-8333-333333333333",
  numero: "SOL-MON-002",
  estado: "ASSIGNED",
};
const antigua = {
  ...primera,
  id: "44444444-4444-4444-8444-444444444444",
  numero: "SOL-MON-003",
  repartidor_asignado_id: segundaMoto.id,
};

export async function prepararMonitoreo(page: Page, conPermiso = true) {
  const control = { finalizar: false, errorGps: 0, errorDirectorio: 0 };
  const peticiones: { metodo: string; ruta: string }[] = [];
  const inesperadas: string[] = [];
  const pagina = (resultados: unknown[]) => ({
    conteo: resultados.length,
    pagina_siguiente: null,
    pagina_anterior: null,
    resultados,
  });
  await page.route("http://api.vitago.test/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    peticiones.push({ metodo: route.request().method(), ruta: url.pathname });
    const enviar = (datos: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(datos),
      });
    if (url.pathname.endsWith("iniciar-sesion/")) return enviar(tokens);
    if (url.pathname.endsWith("mi-perfil/"))
      return enviar({
        ...perfil,
        permisos: conPermiso
          ? [...perfil.permisos, "repartidor.ver_ubicacion"]
          : perfil.permisos,
      });
    if (url.pathname.endsWith("/repartidores/resumenes/")) return enviar(lista);
    if (url.pathname === "/api/v1/seguimiento/motoristas/") {
      const error = control.errorGps || control.errorDirectorio;
      if (error)
        return enviar(
          error === 503 ? { codigo: "CIERRE_OPERATIVO_PENDIENTE" } : {},
          error,
        );
      const hora = new Date().toISOString();
      return enviar({
        ...ejemploGps,
        hora_servidor: hora,
        conteo: control.finalizar ? 0 : 3,
        resultados: control.finalizar
          ? []
          : [motorista, segundaMoto, sinGps].map((m, i) => ({
              ...ejemploGps.resultados[0],
              repartidor_id: m.id,
              usuario_id: m.usuario.id,
              nombre: `${m.usuario.nombres} ${m.usuario.apellidos}`,
              empresa_id: m.empresa_id,
              jornada_id: `jornada-${m.id}`,
              fecha_operativa: hora.slice(0, 10),
              iniciada_en: new Date(Date.now() - 3600000).toISOString(),
              cierre_programado_en: new Date(
                Date.now() + 3600000,
              ).toISOString(),
              estado_operativo: m.estado_operativo,
              en_almuerzo: false,
              solicitudes_activas: i === 0 ? 2 : i === 1 ? 1 : 0,
              tiene_servicios_activos: i < 2,
              ubicacion:
                i === 2
                  ? null
                  : {
                      ...ejemploGps.resultados[0].ubicacion,
                      registrada_en: new Date(
                        Date.now() - (i ? 600000 : 20000),
                      ).toISOString(),
                      recibida_en: hora,
                    },
              estado_ubicacion:
                i === 2
                  ? "SIN_UBICACION"
                  : i === 1
                    ? "DESACTUALIZADA"
                    : "ACTUALIZADA",
              ubicacion_vigente: i === 0,
              antiguedad_segundos: i === 2 ? null : i === 1 ? 600 : 20,
            })),
      });
    }
    if (url.pathname === `/api/v1/repartidores/${motorista.id}/`)
      return enviar({
        ...motorista,
        estado_operativo: "ON_ROUTE",
        solicitudes_activas: 2,
        tubos_en_transporte: 3,
        tubos_reservados: 3,
        tubos_comprometidos: 6,
        tubos_disponibles: 14,
      });
    if (url.pathname === `/api/v1/repartidores/${segundaMoto.id}/`)
      return enviar(segundaMoto);
    if (url.pathname === `/api/v1/repartidores/${sinGps.id}/`)
      return enviar(sinGps);
    if (url.pathname === "/api/v1/repartidores/")
      return enviar(pagina([motorista, segundaMoto, sinGps]));
    if (url.pathname === "/api/v1/solicitudes/")
      return enviar(
        pagina(
          control.finalizar
            ? []
            : [primera, segunda, antigua].filter(
                (s) => s.estado === url.searchParams.get("estado"),
              ),
        ),
      );
    const actual = [primera, segunda, antigua].find((s) =>
      url.pathname.includes(`/${s.id}/`),
    );
    if (actual && url.pathname === `/api/v1/solicitudes/${actual.id}/`)
      return enviar({
        ...actual,
        articulos_historicos: [
          {
            id: "55555555-5555-4555-8555-555555555555",
            tipo_articulo: "Contenedor de prueba",
            descripcion: "Artículo del contrato, solo pruebas",
            cantidad: "2",
            codigo_referencia: "REF-PRUEBA",
            condicion_transporte: "Mantener temperatura",
            notas: null,
          },
        ],
      });
    inesperadas.push(url.pathname);
    return enviar({}, 404);
  });
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill("admin@example.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("prueba");
  await page.getByRole("button", { name: "Entrar al panel" }).click();
  await expect(
    page.getByRole("heading", { name: "Resúmenes diarios", exact: true }),
  ).toBeVisible();
  return { control, peticiones, inesperadas };
}
export async function abrirMonitoreo(page: Page) {
  await page.goto("/monitorear");
  await expect(
    page.getByRole("heading", { name: "Monitorear", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("3 motoristas · 2 con ubicación · 1 sin punto disponible", {
      exact: true,
    }),
  ).toBeVisible();
}
