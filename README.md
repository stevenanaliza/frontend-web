# VitaGo Corporate · Panel administrativo

Repositorio `frontend-web`: panel en React, TypeScript y Vite que consume directamente el backend Django mediante JWT. La publicación contiene archivos estáticos; no requiere un servidor Node de sesiones ni cookies de autenticación del panel. Node y npm se utilizan para desarrollar, compilar y ejecutar las pruebas.

El contrato oficial es [VITAGO_API_FRONTEND.md](./VITAGO_API_FRONTEND.md), actualizado a 0.41.0. El proyecto Flutter y el backend Django permanecen sin modificaciones.

## Iniciar el proyecto

Requiere Node.js 22.12 o superior y npm. Se verificó con Node.js 24.18.0.

```powershell
npm ci
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm run dev
```

Configurar `.env.local` con el origen del backend Corporate, **sin `/api/v1/`**, rutas, parámetros ni credenciales:

```dotenv
VITE_API_URL=https://backend-corporate.ejemplo.com
VITE_API_PROXY=false
```

La dirección es ilustrativa. Reiniciar Vite al cambiar las variables. Abrir `http://127.0.0.1:5173`. Sin URL configurada, se explica el problema y se deshabilita el acceso; no hay datos ficticios para ocultar errores.

Para el backend local existente puede conservarse `VITE_API_PROXY=true`: Vite reenvía las peticiones durante `npm run dev` para facilitar el desarrollo sin CORS. Este proxy no almacena sesiones, no se compila y no se utiliza en Vercel. Con `false`, el navegador consulta Django directamente también en desarrollo.

## Publicar en Vercel

El archivo `.env.production` configura el backend Corporate publicado en `https://vitago.onrender.com`. Vite lo utiliza al compilar; las variables del alojamiento tienen prioridad. El panel público confirmado es `https://frontend-web-eight-self.vercel.app`.

1. Configurar `VITE_API_URL` con el origen HTTPS del backend Corporate público.
2. Seleccionar Vite, compilación `npm run build` y directorio `dist`. [vercel.json](./vercel.json) incluye estos valores y las rutas internas de React.
3. Volver a desplegar después de cambiar la URL: Vite la incorpora durante la compilación.
4. Autorizar el origen exacto del panel en el CORS del backend y verificar el acceso desde el dominio publicado.

No se ejecuta `npm start` ni se requieren variables privadas de un servidor del panel. `VITE_WEB_SESSION`, `VITE_WEB_ORIGIN`, `BACKEND_URL` y `WEB_PUBLIC_ORIGIN` dejaron de utilizarse y pueden retirarse de la configuración del frontend. Ninguna variable `VITE_*` debe contener contraseñas, tokens o claves privadas.

Ver [deploy/README.md](./deploy/README.md) para CORS, configuración y comprobaciones.

## Alcance implementado

| Módulo                | Funciones                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Acceso                | Correo/contraseña, recuperación al recargar, perfil, permisos, rotación JWT y cierre de sesión                    |
| Resúmenes diarios     | Fecha operativa, filtros, paginación remota, detalle del motorista y temperaturas                                 |
| Solicitudes           | Creación con catálogos autorizados, modalidades, artículos y tubos; agrupaciones, filtros, detalle e historial    |
| Operaciones           | Asignar/reasignar, corregir tubos con motivo y cancelar según estado y permisos                                   |
| Evidencias            | Metadatos e imágenes privadas solicitadas con Bearer y object URLs temporales                                     |
| Motoristas            | Directorio, carga actual y cupo individual efectivo; alta de perfil y motocicleta                                 |
| Límites de motoristas | Configuración compartida por empresa en Corporate o general de Network, según alcance y permisos                  |
| Usuarios              | Alta, detalle, edición, catálogo de roles delegables, asignación/revocación y contraseñas                         |
| Sucursales            | Directorio y alta con ubicación aprobada de la empresa                                                            |
| Administración        | Accesos directos a las altas y gestiones disponibles según los permisos de la cuenta                              |
| Empresas              | Consulta de datos y contacto; accesos a sucursales, ubicaciones y flota de cada empresa                           |
| Ubicaciones           | Directorio, registro manual con país de la empresa, coordenadas y aprobación del uso como origen o destino        |
| Vehículos             | Directorio y alta independiente de motocicletas con estado inicial                                                |
| Mi cuenta             | Datos, contraseña propia cuando el restablecimiento administrativo está autorizado y cierre de todas las sesiones |

Las rutas y acciones se protegen por permisos. Los solicitantes y motoristas sin permisos administrativos no pueden entrar. Los reportes requieren conjuntamente `repartidor.ver`, `reporte.ver`, `solicitud.ver`, `jornada.ver` y `evidencia.ver`. Django decide siempre la autorización y el alcance definitivos.

Se distinguen actividad del día y carga actual; cero y `null`; kilómetros medidos, consolidados e incompletos de jornadas cerradas. Los hitos y artículos no se suman para inventar cantidades. La capacidad y los límites los calcula el backend. Las tablas y selectores consultan una página del servidor cada vez.

Las respuestas se validan con Zod. Los errores por campo conservan los valores del formulario; se distinguen HTTP 400, 401, 403, 404, 409, 429 y 5xx de fallos de conexión. Ninguna operación de escritura se repite automáticamente.

La creación de solicitudes consulta `opciones-creacion/` por empresa, modalidad y origen. Solo permite elegir destinos devueltos por Django; al cambiar modalidad u origen descarta el destino anterior. Los envíos especiales dependen del catálogo autorizado y usan una descripción con `destino_id: null`. La cantidad de tubos es independiente de las cantidades de los artículos. El servidor crea el traslado y decide su asignación automática; el panel muestra el resultado real.

El contrato vigente no expone altas o edición de los datos generales de empresas, edición de sucursales ni edición de vehículos existentes. El panel ofrece la consulta de esos registros y las altas disponibles. Tampoco permite cambiar el usuario o la motocicleta de un motorista ya creado. Desde 0.41.0 se retiró la configuración individual de límites del motorista.

En `/limites-motoristas`, Corporate consulta y modifica la configuración de una empresa mediante `organizaciones/empresas/{id}/limites-motoristas/`. La escritura requiere `empresa.administrar` y alcance de empresa completo o global. Si Django devuelve `alcance: RED`, se utiliza exclusivamente `organizaciones/configuracion/limites-motoristas/`; solo `configuracion.administrar` con alcance global habilita su edición. Un administrador de empresa cliente Network la consulta sin modificarla.

Los límites se aplican individualmente a cada motorista: no forman un fondo compartido entre conductores. El servidor valida reducciones contra la carga comprometida. Los formularios conservan campos y valores ante 400/403/409 y nunca repiten el PATCH automáticamente. Tras guardar se muestran los valores devueltos y se refrescan las consultas montadas de empresas, motoristas, disponibles y resúmenes; al volver a una pantalla se consulta de nuevo, sin caché persistida de cupos.

La migración y el despliegue externos de 0.41.0 están pendientes según el contrato recibido. Un 404 del nuevo endpoint se presenta como configuración no disponible, sin volver a la edición individual ni inventar límites. Esta adaptación queda local y no realiza operaciones de Git ni publicación.

## Sesión JWT y contraseñas

React llama a `iniciar-sesion/` de Django con `correo` y `contrasena`. Guarda juntos el access token, el refresh token, sus expiraciones y el identificador de sesión en `sessionStorage`, separados por origen del backend Corporate. No se guardan contraseñas ni se utiliza `localStorage`. Si el navegador bloquea el almacenamiento, la sesión permanece solo en memoria y no se recupera tras recargar.

Las consultas protegidas llevan `Authorization: Bearer`. Las peticiones usan `credentials: omit`, sin autenticación por cookies. Al recargar, se vuelve a consultar `mi-perfil/`; no se confía en permisos persistidos.

La renovación usa las expiraciones recibidas de Django, sustituye conjuntamente ambos tokens y coordina las peticiones concurrentes de esta pestaña con una sola renovación. Solo un GET puede repetirse una vez tras un 401. Un fallo de renovación elimina las credenciales y exige iniciar sesión. Las respuestas pendientes de una sesión anterior no pueden restaurarla ni sobrescribir un acceso nuevo.

La sesión se conserva en la pestaña. No se ofrece una sesión compartida automática entre pestañas; Django determina la revocación de las demás sesiones y cualquier consulta posterior con credenciales revocadas exige nuevo acceso. Los JWT son accesibles al JavaScript de la aplicación, como corresponde a este cliente directo.

El cierre actual utiliza `cerrar-sesion/` y elimina las credenciales tras el 204. Si no hay conexión, la pantalla permite salir localmente, sin afirmar que Django haya revocado la sesión. El cierre de todas las sesiones y el cambio autorizado de contraseña propia también eliminan las credenciales locales.

El contrato ofrece restablecimiento administrativo de contraseña, que revoca las sesiones. No ofrece recuperación pública por correo ni cambio personal con contraseña anterior; no se inventan esos endpoints. Ver [contratos comprobados](./CONTRATOS_WEB_VERIFICADOS.md).

## Monitorear · Google Maps

La ruta `/monitorear` muestra un punto por motorista con seguimiento operativo disponible y permite abrir su carga, vehículo, solicitudes y artículos. Exige `repartidor.ver`, `solicitud.ver` y `solicitud.ver_seguimiento`, con el alcance autorizado por Django.

La API solo permite consultar GPS mediante solicitudes activas: `/api/v1/solicitudes/{id}/seguimiento/`. Los motoristas sin ese seguimiento permanecen en el listado sin un punto en el mapa. No se usa la ubicación de inicio de jornada ni una evidencia histórica para afirmar dónde están ahora. Se muestra la fecha de captura y se distingue una ubicación de más de dos minutos. No se dibujan recorridos ni se solicitan rutas, geocodificación o Fleet Engine.

La consulta se repite 15 segundos después de completar cada lectura, sin solapar ciclos y con un máximo de cuatro peticiones simultáneas por lote. Se pausa al ocultar la pestaña, salir de la pantalla o producirse un error. Los fallos de GPS eliminan el punto afectado; Actualizar permite reintentar. Las lecturas recorren la paginación del directorio y de los estados activos sin seguir URLs externas del paginador. Los totales de carga provienen del servidor; el detalle incluye las solicitudes visibles al administrador.

Configurar en `.env.local`:

```dotenv
VITE_GOOGLE_MAPS_API_KEY=clave_web_de_google_maps
VITE_GOOGLE_MAPS_MAP_ID=
```

Crear una clave web independiente de la móvil y limitarla a **Maps JavaScript API** y a los sitios permitidos. Producción: `https://frontend-web-eight-self.vercel.app/*`; desarrollo: `http://127.0.0.1:5173/*` o el puerto usado. Para la prueba de navegador real se utiliza `http://127.0.0.1:5174/*`. El Map ID propio permite personalizar el mapa; si está vacío se usa `DEMO_MAP_ID`. La clave web se incorpora al cliente Vite y debe restringirse por sitio y API; no es una credencial del backend. El uso puede generar cargos en Google Cloud. Para prototipos Google ofrece una [Maps Demo Key](https://mapsplatform.google.com/maps-demo-key?utm_campaign=gmp_git_agentskills_v1), con límites propios y sin uso productivo.

Para una futura publicación, configurar también `VITE_GOOGLE_MAPS_API_KEY` y, si corresponde, `VITE_GOOGLE_MAPS_MAP_ID` en el entorno de producción de Vercel y volver a compilar. `.env.local` no se publica como configuración de la plataforma. El encabezado `Referrer-Policy` permite enviar únicamente el origen a Google para validar la restricción de sitios web. Se conserva la atribución del mapa y el acceso a los términos y privacidad de Google.

Las pruebas habituales simulan el servicio de mapas y utilizan una clave ficticia; ejecutan el SDK React real y no consumen cuotas de Google. Para una comprobación opcional del mapa real, con GPS ilustrativo de la API de prueba:

```powershell
$env:VITAGO_MAPA_REAL = '1'
npx playwright test tests/e2e/monitoreo.spec.ts --grep 'Google Maps real'
Remove-Item Env:VITAGO_MAPA_REAL
```

Esta comprobación requiere clave local y referente autorizado. Deshabilita trazas y capturas automáticas para no guardar URLs con la clave. Ninguna prueba modifica la base operativa.

## Verificación

```powershell
npm test
npm run build
npm run test:e2e
npm run format:check
```

Las pruebas cubren contratos, permisos, errores, paginación y operaciones administrativas. Los escenarios de sesión sirven una compilación estática y acceden a una API HTTP de prueba en otro origen: comprueban CORS, Bearer, recuperación, renovación, salida y cambio de contraseña sin cookies ni servidor de sesiones. Las pruebas de escritura no modifican bases operativas.

La adaptación 0.41.0 pasó **40 pruebas unitarias y 50 escenarios de navegador**, además de compilación y formato. Se comprueban permisos de empresa/sucursal/red, configuración compartida, rechazo del PATCH individual, actualización de lecturas, errores por campo y capturas a 1440, 768 y 375 píxeles.

La revisión responsive recorre el acceso y 17 pantallas administrativas en diez anchos entre 320 y 2560 píxeles, con nombres y correos largos. Incluye orientación horizontal, controles táctiles, teclado, cambio de tableta a escritorio y texto del sistema ampliado. Se ejecuta con `npx playwright test tests/e2e/responsive.spec.ts`; genera capturas en `artifacts/responsive/`. Son pruebas en Chrome con tamaños y entrada táctil simulados, usando una API aislada.

Las capturas en `artifacts/` contienen datos de prueba. El panel está publicado en Vercel y se comprobó que Django responde a salud, perfil sin sesión y login vacío con CORS correcto. El acceso administrativo y las escrituras con datos reales requieren una cuenta autorizada; las pruebas de formularios utilizan una API aislada. Ver [diagnóstico de conexión](./deploy/README.md).

Para revisar la compilación localmente:

```powershell
npm run build
npm run preview
```

Corporate y Network mantienen dominios, bases, sesiones y configuración independientes. Se conserva la identidad Corporate, con la marca del móvil, Manrope y DM Sans y alternativas locales. Ver [revisión](./REVISION_FRONTEND.md).
