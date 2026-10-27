# VitaGo Corporate · Panel administrativo

Frontend independiente en React, TypeScript y Vite. No modifica el proyecto Flutter ni el backend Django. El contrato de integración es [VITAGO_API_FRONTEND.md](./VITAGO_API_FRONTEND.md), especialmente las secciones 0.39.0 y 0.40.0.

## Iniciar el proyecto

Requiere Node.js 22.12 o superior y npm. Se verificó con Node.js 24.18.0.

```powershell
npm ci
Copy-Item .env.example .env.local
```

En `.env.local`, colocar **el origen real del backend Corporate**, sin `/api/v1/`, rutas, parámetros ni credenciales:

```dotenv
VITE_API_URL=https://backend-corporate.ejemplo.com
```

Esa dirección es ilustrativa; el proyecto no trae una dirección operativa preconfigurada. Las variables `VITE_*` son públicas: no colocar contraseñas, tokens o claves privadas. Reiniciar Vite al cambiarlas.

Para desarrollo local cuando Django no habilita CORS, agregar `VITE_API_PROXY=true` en `.env.local`. El navegador solicita `/api/v1/` al servidor de Vite y este reenvía las peticiones al origen de `VITE_API_URL`. Se utiliza el [proxy de desarrollo de Vite](https://vite.dev/config/server-options#server-proxy); solo está activo en `npm run dev`. La compilación de producción continúa utilizando directamente el origen configurado y requiere CORS correcto o un proxy de alojamiento definido por infraestructura.

```powershell
npm run dev
```

Abrir `http://127.0.0.1:5173`. Sin configuración, se muestra una explicación y se deshabilita el acceso. No hay modo de demostración ni sustitución de fallos por datos ficticios.

## Alcance implementado

- Inicio de sesión con `correo` y `contrasena`; recuperación de sesión al recargar la pestaña; consulta de perfil y permisos; renovación del par de tokens; cierre remoto de sesión.
- Protección de las rutas y del panel. Los permisos operativos de solicitantes o motoristas por sí solos no permiten entrar. Los reportes exigen conjuntamente `repartidor.ver`, `reporte.ver`, `solicitud.ver`, `jornada.ver` y `evidencia.ver`.
- Listado de resúmenes por motorista con fecha operativa, perfiles activos/inactivos, UUID de empresa/motorista y 20, 50 o 100 filas por página. Los filtros avanzados usan UUID porque no se presupone acceso a catálogos adicionales.
- Paginación remota en lista y lecturas; solo se solicita la página visible. No se siguen enlaces arbitrarios del servidor con tokens: se solicita la siguiente página al mismo endpoint configurado.
- Detalle de motorista con actividad del día, cantidades conocidas y faltantes, kilómetros medidos/consolidados y estado incompleto, estadísticas y todas las lecturas de temperatura.
- Carga actual separada del día histórico, con límites y disponibilidad calculados por el servidor, sin reinterpretar su capacidad.
- Presentación de ceros y `null` por separado; no se suman hitos de solicitudes ni se diagnostican temperaturas.
- Estados de carga, vacío, error y falta de permisos. Errores de campo conservados y diferenciación de HTTP 400/401/403/404/409/429/5xx frente a problemas de conexión.
- Solicitudes agrupadas por sucursal o solicitante, incluyendo «Sin sucursal», creador de cada solicitud, filtros de estado/prioridad, detalle, artículos e historial. Grupos y solicitudes se paginan por separado en el servidor.
- Directorio de motoristas, carga actual y edición del límite de tubos con motivo, exclusivamente con `repartidor.administrar`. La respuesta del backend confirma el nuevo límite; el frontend no recalcula la capacidad.
- Directorio y detalle de usuarios con historial de roles. Edición de nombres, apellidos, teléfono y estado únicamente con `usuario.administrar`; las reglas de delegación y protección de cuentas las aplica el backend.
- Directorio de sucursales para la empresa elegida. Si el perfil no indica una empresa, puede seleccionarse por identificador y, con `empresa.ver`, mediante el catálogo paginado.
- Evidencias por solicitud, metadatos y temperatura; imágenes binarias mediante Bearer y object URLs temporales liberadas al cerrar o navegar.

Las altas de usuarios, sucursales y motoristas, la asignación/revocación de roles y la asignación de servicios siguen pendientes. Esta entrega habilita consultas y las dos ediciones indicadas; el historial de roles es de consulta. Ver [revisión y siguientes pasos](./REVISION_FRONTEND.md).

La paleta Corporate y la imagen de marca se tomaron del proyecto móvil existente mediante lectura; el móvil permanece intacto.

## Endpoints utilizados

| Método | Ruta                                                          | Uso                                 |
| ------ | ------------------------------------------------------------- | ----------------------------------- |
| POST   | `/api/v1/autenticacion/iniciar-sesion/`                       | Autenticación local                 |
| POST   | `/api/v1/autenticacion/renovar/`                              | Rotación del par de tokens          |
| POST   | `/api/v1/autenticacion/cerrar-sesion/`                        | Revocación de la sesión actual      |
| GET    | `/api/v1/usuarios/mi-perfil/`                                 | Perfil, roles y permisos            |
| GET    | `/api/v1/repartidores/resumenes/`                             | Página de resúmenes                 |
| GET    | `/api/v1/repartidores/{id}/resumen/`                          | Detalle administrativo              |
| GET    | `/api/v1/repartidores/{id}/temperaturas/`                     | Página de lecturas                  |
| GET    | `/api/v1/repartidores/`                                       | Directorio de motoristas            |
| PATCH  | `/api/v1/repartidores/{id}/`                                  | Cambio de límite con motivo         |
| GET    | `/api/v1/solicitudes/agrupaciones/`                           | Grupos por sucursal o solicitante   |
| GET    | `/api/v1/solicitudes/`                                        | Página del grupo seleccionado       |
| GET    | `/api/v1/solicitudes/{id}/`                                   | Detalle e historial de la solicitud |
| GET    | `/api/v1/solicitudes/{id}/evidencias/`                        | Página de evidencias                |
| GET    | `/api/v1/solicitudes/{id}/evidencias/{evidencia_id}/archivo/` | Imagen protegida                    |
| GET    | `/api/v1/usuarios/`                                           | Directorio de usuarios              |
| GET    | `/api/v1/usuarios/{id}/`                                      | Perfil administrativo de usuario    |
| PATCH  | `/api/v1/usuarios/{id}/`                                      | Edición autorizada del usuario      |
| GET    | `/api/v1/usuarios/{id}/roles/`                                | Historial de roles                  |
| GET    | `/api/v1/organizaciones/empresas/`                            | Selector paginado de empresa        |
| GET    | `/api/v1/organizaciones/empresas/{id}/sucursales/`            | Directorio de sucursales            |

Las respuestas se validan con Zod según el documento. Una respuesta incompatible se informa como problema de contrato; no se completan campos ausentes con ceros. Los permisos del perfil permiten construir la interfaz, pero no describen la relación individual permiso/alcance de cada rol: el backend determina el alcance efectivo, filtra y puede devolver 403/404.

## Sesión web y decisiones pendientes

El contrato exige almacenamiento seguro del sistema operativo, descrito para clientes nativos. El navegador no ofrece a esta SPA ese mecanismo. Para recuperar la sesión en una recarga se usa **`sessionStorage` de la pestaña**, separado por origen del backend y producto; no se usa `localStorage`, ni se registran tokens o contraseñas. Si el navegador impide persistir, la sesión permanece únicamente en memoria y no sobrevive a la recarga. `sessionStorage` es accesible por JavaScript del mismo origen y **no equivale a almacenamiento seguro nativo**.

Antes de desplegar en producción debe acordarse el contrato específico para persistencia web (por ejemplo, sesión mediante cookies HttpOnly/Secure o un BFF). No se han inventado esos endpoints ni modificado Django. La renovación se coordina dentro de la instancia del panel; la coordinación de sesiones clonadas en varias pestañas no está cubierta. Usar una sola pestaña por sesión hasta definir esa política.

Las expiraciones se toman de las respuestas, sin duraciones JWT fijas. Un fallo de renovación limpia los tokens y pide iniciar sesión. Un GET con 401 puede renovarse y repetirse una sola vez; las mutaciones nunca se repiten automáticamente. Un 429 de login usa la espera recibida con reloj monotónico. Si falla el cierre remoto, se informa y se ofrece salir localmente; salir localmente no confirma revocación en el servidor.

No se implementa restablecimiento público de contraseña: el contrato documenta un restablecimiento administrativo, no una API pública de recuperación. Si Corporate cambia de proveedor `LOCAL` a `JWT_CORPORATIVO`, hará falta documentar su flujo de acceso web/SSO antes de sustituir este login.

## Verificación

```powershell
npm test
npm run test:e2e
npm run build
npm run format:check
```

Las pruebas de navegador usan Google Chrome instalado (`channel: chrome`) y arrancan Vite en el puerto 5174 con un origen `.test` interceptado por Playwright. Nunca usan las bases Corporate o Network. Las respuestas ilustrativas se extraen del documento oficial **solo dentro de las pruebas**. Las capturas generadas en `artifacts/` contienen datos de prueba, no datos operativos.

Se cubren rotación de tokens con solicitudes concurrentes, límites de reintento, errores HTTP y por campo, permisos conjuntos, denegación a cuentas operativas, navegación, filtros, páginas remotas, recuperación al recargar, cierre de sesión, desconocidos frente a cero y diseño en 1440/1024/768/375 px.

Verificación del 2026-10-27: **28 pruebas unitarias y 18 escenarios de navegador aprobados**. Se comprobaron contratos, filtros, paginación, acceso restringido, imágenes privadas, actualización de límites y usuarios, errores por campo sin reintentos y conservación de los valores del formulario. Las capturas incluyen acceso, reportes, solicitudes, motoristas, usuarios y sucursales en escritorio y tablet. Compilación de producción y formato comprobados.

**Configuración local actual:** el usuario confirmó `http://127.0.0.1:8001/api/v1/` como URL de Corporate. Se guardaron `VITE_API_URL=http://127.0.0.1:8001` y `VITE_API_PROXY=true` en `.env.local` (excluido de Git); el cliente agrega `/api/v1/` automáticamente y utiliza el proxy durante desarrollo.

**Estado de integración real:** Corporate ya responde. Se verificaron a través del proxy salud 200 con `servicio=VitaGo Corporate`, login vacío 400 con errores de `correo` y `contrasena`, y respuestas 401 sin credenciales en resúmenes, motoristas, agrupaciones y usuarios. El usuario confirmó que inició sesión. La automatización de su ventana Chrome se detuvo porque no pudo identificar con seguridad la URL actual: **no se validaron de forma independiente sus datos autenticados ni se realizaron ediciones en registros reales**. Las pruebas de las nuevas operaciones se ejecutaron con respuestas aisladas del contrato, sin acceder a las bases operativas.

**Diagnóstico local de CORS:** al estar disponible el backend, OPTIONS devolvió 200 con metadatos de DRF, pero sin `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods` ni `Access-Control-Allow-Headers`. El navegador no podía continuar el login directo entre los puertos 5173 y 8001. El proxy de Vite resuelve la conexión local dentro del proyecto web; no se modificó Django. La comprobación anterior de falta de conexión quedó superada al arrancar el servicio.

## Despliegue

```powershell
npm run build
```

Publicar `dist/` en el alojamiento elegido. Configurar la reescritura de rutas de la SPA hacia `index.html` para permitir recargar enlaces de detalle. La URL del backend se incorpora al compilar: Corporate y Network deben mantener compilaciones, orígenes y configuraciones independientes. Este proyecto está destinado a Corporate y no ofrece un selector para mezclar entornos.

Si el backend tiene otro origen, su infraestructura debe permitir el origen web autorizado y los encabezados `Authorization` y `Content-Type`, además de las solicitudes OPTIONS correspondientes. Exponer `Retry-After` si se quiere leer ese encabezado desde el navegador; el cuerpo `segundos_espera` también está contemplado. El frontend no puede corregir CORS ni habilitar proveedores de autenticación desde el navegador. En producción usar HTTPS y acordar la política de sesión web descrita arriba.

Las fuentes DM Sans y Manrope se solicitan a Google Fonts, con alternativas locales si no están disponibles. Los colores de marca se centralizan en las variables CSS de `src/styles.css`.
#   f r o n t e n d - w e b  
 #   f r o n t e n d - w e b  
 #   f r o n t e n d - w e b  
 