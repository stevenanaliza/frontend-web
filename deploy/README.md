# Publicar VitaGo Corporate en Vercel

## Arquitectura

El navegador ejecuta React y consulta directamente el backend Django Corporate mediante JWT. Vercel sirve `dist/`. El panel no requiere servidor Node, almacén de sesiones, cookies HttpOnly ni Functions. Node y npm se usan para compilar y probar.

## Variables y compilación

En Vercel, configurar para el entorno de producción:

```dotenv
VITE_API_URL=https://vitago.onrender.com
VITE_API_PROXY=false
```

Este es el backend Corporate confirmado. Usar el origen HTTPS, sin `/api/v1/`, ruta, parámetros o credenciales. El cliente añade las rutas oficiales. `127.0.0.1` no identifica el backend publicado: en el navegador del visitante apunta a su propio equipo.

`.env.production` ya contiene estos valores y puede versionarse porque no contiene secretos. Vite lo carga al compilar en producción; las variables configuradas en Vercel tienen prioridad. Una variable `VITE_API_URL` vacía en Vercel debe corregirse o eliminarse para utilizar el archivo. La compilación falla si falta el origen o contiene una ruta; en Vercel también exige HTTPS.

Seleccionar:

| Ajuste           | Valor           |
| ---------------- | --------------- |
| Framework        | Vite            |
| Build Command    | `npm run build` |
| Output Directory | `dist`          |
| Install Command  | `npm ci`        |

`vercel.json` declara la compilación, el directorio y la reescritura de las rutas de React a `index.html`. Esto permite recargar rutas como `/mi-cuenta` y `/usuarios`. Las peticiones de datos llevan la URL absoluta de Django y no pasan por esa reescritura.

Las variables `VITE_*` son públicas y se incorporan al JavaScript al compilar. Cambiar la URL requiere volver a desplegar. No colocar claves privadas ni contraseñas en ellas.

Eliminar de la configuración del frontend las variables antiguas `VITE_WEB_SESSION`, `VITE_WEB_ORIGIN`, `BACKEND_URL`, `WEB_PUBLIC_ORIGIN`, `WEB_HOST`, `WEB_DEV_HTTP` y `PORT`, si se habían añadido para el servidor de sesiones anterior. No se utilizan ni existe un comando `npm start` para este frontend.

## Requisito del backend: CORS

El equipo del backend debe autorizar el origen exacto del panel, por ejemplo `https://panel-corporate.ejemplo.com`, sin ruta ni barra final. El dominio definitivo y cualquier dominio de prueba deben autorizarse explícitamente.

La respuesta al preflight OPTIONS debe permitir:

- El origen del panel mediante `Access-Control-Allow-Origin`.
- Los métodos usados: GET, POST, PATCH, DELETE y OPTIONS.
- Los encabezados `Authorization` y `Content-Type`.
- Exponer `Retry-After` si se quiere leer su valor desde el navegador.

Las respuestas reales también deben incluir los encabezados CORS correspondientes, incluidos los errores 400, 401, 403, 409 y 429. Un OPTIONS 200 sin ellos no permite enviar el login. No activar cookies cross-site: este cliente usa `credentials: omit` y Bearer.

El backend actual ya utiliza `django-cors-headers`. Se comprobó mediante lectura que configura `CORS_ALLOWED_ORIGINS` desde `ORIGENES_WEB_PERMITIDOS`. El valor del panel confirmado es:

```dotenv
ORIGENES_WEB_PERMITIDOS=https://frontend-web-eight-self.vercel.app
```

Su configuración oficial incluye `CORS_ALLOWED_ORIGINS`, `CORS_ALLOW_METHODS`, `CORS_ALLOW_HEADERS` y `CORS_EXPOSE_HEADERS`. Esto documenta lo que requiere el panel; esta entrega no instala paquetes ni modifica Django. El proyecto actual del backend configura sus hosts mediante `SERVIDORES_PERMITIDOS`; la lista debe incluir el hostname del propio backend y es independiente de CORS.

El acceso por correo y contraseña usa el proveedor `LOCAL` documentado. Corporate y Network mantienen configuración, bases y sesiones independientes.

## Comprobación después de publicar

1. Abrir el panel y acceder con una cuenta administrativa.
2. Comprobar en Network que login, perfil y reportes llegan al dominio de Django; las peticiones protegidas llevan Bearer.
3. Recargar `/mi-cuenta` y una ruta de reportes. Deben funcionar sin 404 del alojamiento y recuperar el perfil de Django.
4. Comprobar renovación JWT, permisos, imágenes privadas y errores por campo.
5. Cerrar sesión y recargar: no debe restaurarse. El cierre de todas las sesiones y el cambio de contraseña propia autorizado deben exigir un nuevo acceso.

Las pruebas automatizadas comprueban el cliente compilado contra una API HTTP aislada con CORS. El acceso administrativo real y las operaciones sobre datos reales requieren una sesión autorizada; no se afirma que estén verificados en el despliegue público.

## Diagnóstico público previo · 2026-10-27

URLs confirmadas por el usuario:

- Panel: `https://frontend-web-eight-self.vercel.app`.
- API: `https://vitago.onrender.com/api/v1/`.

Comprobaciones efectuadas sin cuenta, contraseña ni tokens reales:

| Comprobación                                                           | Resultado                                                                      |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `GET /api/v1/salud/`                                                   | 200, servicio `VitaGo Corporate`                                               |
| Preflight de login desde el dominio del panel                          | 200, origen exacto autorizado, métodos y encabezados permitidos                |
| Consulta de salud desde Chrome aislado en el dominio público del panel | 200, legible por el navegador                                                  |
| Perfil sin Bearer desde ese navegador                                  | 401, JSON legible por el navegador                                             |
| Login con JSON vacío desde ese navegador                               | 400, errores `correo` y `contrasena` legibles por el navegador                 |
| JavaScript publicado `index-8NO9sAKc.js`                               | Cliente inicializado con origen vacío; falta `VITE_API_URL` en esa compilación |
| Abrir `/mi-cuenta` directamente en el despliegue actual                | 404; falta publicar la reescritura de rutas de `vercel.json`                   |

Este diagnóstico corresponde al despliegue anterior. Los cambios de `.env.production`, validación de configuración, `vercel.json` y todos los módulos pendientes del frontend se publicaron en el commit `1e39bf12cd463d38dc63a3f26f67d2685cb2e0be`. La publicación y las comprobaciones siguientes resuelven los problemas de URL y rutas identificados arriba.

## Publicación verificada · 2026-10-27

Proyecto `frontend-web`, equipo `vita-go`. Despliegue de producción `dpl_7BETR9PpK5dX7z9JyuZgEfttG334`, estado `READY`, asignado a `https://frontend-web-eight-self.vercel.app`.

El primer intento del commit falló porque `VITE_API_URL` en Vercel sustituía el archivo preparado por un origen HTTP. Se corrigieron las variables de producción a `VITE_API_URL=https://vitago.onrender.com` y `VITE_API_PROXY=false`, y se volvió a desplegar el mismo commit. La compilación remota terminó correctamente; publica `index-Dl0u1akA.js`, que incorpora el origen HTTPS de Django.

Comprobación con Chrome aislado, sin credenciales reales:

| Comprobación                                                      | Resultado                                                                             |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Apertura directa de `/`, `/mi-cuenta`, `/usuarios` y `/resumenes` | HTTP 200; React muestra el acceso cuando no hay sesión                                |
| Configuración del cliente                                         | Origen de Django presente; sin aviso de configuración pendiente                       |
| Salud desde el origen público del panel                           | HTTP 200, servicio `VitaGo Corporate`, JSON legible                                   |
| Perfil sin Bearer desde ese navegador                             | HTTP 401, JSON legible                                                                |
| Login con JSON vacío desde ese navegador                          | HTTP 400, errores `correo` y `contrasena` legibles; el navegador permite el preflight |
| Errores de ejecución de la página                                 | Ninguno durante la comprobación                                                       |

Antes de publicar pasaron la compilación, 35 pruebas unitarias, 33 pruebas de navegador y la revisión de formato. La consulta de logs de errores y fallos del despliegue en los últimos 15 minutos no devolvió registros. El proyecto no tiene drains configurados; Vercel sirve archivos estáticos y Django atiende la API.

No se modificaron el backend ni el móvil. Sigue pendiente comprobar el acceso con una cuenta administrativa real y las operaciones protegidas sobre datos reales; la renovación y el cierre JWT sí están cubiertos por las pruebas aisladas.

## Actualización administrativa · 2026-10-28

La nueva entrada `/administracion` reúne las altas disponibles. Se incorporan `/solicitudes/nueva`, `/empresas`, `/ubicaciones` y `/vehiculos`. Las nuevas pantallas consumen el mismo backend HTTPS con JWT directo y respetan los permisos recibidos; no requieren variables adicionales ni cambios en Django o Flutter.

La validación utiliza catálogos y escrituras aisladas de Playwright, sin crear registros en producción. Las empresas permanecen de consulta y no se ofrecen operaciones que la API actual no expone. Al publicar, comprobar el estado `READY`, el commit de `main`, el JavaScript nuevo y la carga directa de las nuevas rutas; el acceso con una cuenta real continúa siendo una comprobación independiente.

## Adaptación 0.41.0 pendiente de publicar

La copia local mueve los límites de motoristas a la configuración compartida de empresa o red. Antes de publicar esta adaptación, el servicio debe disponer del código 0.41.0 y de la migración `organizaciones.0003_limites_motoristas_compartidos` en su base externa, pendientes según el contrato recibido. Una respuesta 404 en la nueva configuración se muestra sin habilitar el PATCH individual retirado.

Esta adaptación no modifica backend, móvil, entornos ni despliegues. El usuario realiza todas las operaciones de Git; no se ejecutan desde el asistente.

## Desarrollo local

`npm run dev` usa el puerto 5173. En `.env.local`, `VITE_API_URL` apunta al backend local. Puede conservarse `VITE_API_PROXY=true` solo para desarrollo: Vite reenvía las rutas `/api/v1/`, sin gestionar tokens ni sesiones. En producción el navegador siempre consulta directamente Django, independientemente de ese valor.

Para revisar archivos compilados: `npm run build` y `npm run preview`. El backend debe permitir por CORS el origen usado para esa revisión.

Referencias: [Vite en Vercel](https://vercel.com/docs/frameworks/frontend/vite) y [configuración oficial de django-cors-headers](https://github.com/adamchainz/django-cors-headers#configuration).
