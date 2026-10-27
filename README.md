# VitaGo Corporate · Panel administrativo

Repositorio `frontend-web`: panel en React, TypeScript y Vite que consume directamente el backend Django mediante JWT. La publicación contiene archivos estáticos; no requiere un servidor Node de sesiones ni cookies de autenticación del panel. Node y npm se utilizan para desarrollar, compilar y ejecutar las pruebas.

El contrato oficial es [VITAGO_API_FRONTEND.md](./VITAGO_API_FRONTEND.md), especialmente 0.39.0 y 0.40.0. El proyecto Flutter y el backend Django permanecen sin modificaciones.

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

| Módulo            | Funciones                                                                                                         |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| Acceso            | Correo/contraseña, recuperación al recargar, perfil, permisos, rotación JWT y cierre de sesión                    |
| Resúmenes diarios | Fecha operativa, filtros, paginación remota, detalle del motorista y temperaturas                                 |
| Solicitudes       | Agrupaciones por sucursal o solicitante, creador, filtros, detalle, artículos e historial                         |
| Operaciones       | Asignar/reasignar, corregir tubos con motivo y cancelar según estado y permisos                                   |
| Evidencias        | Metadatos e imágenes privadas solicitadas con Bearer y object URLs temporales                                     |
| Motoristas        | Directorio, carga actual, límite autorizado, alta de perfil y motocicleta                                         |
| Usuarios          | Alta, detalle, edición, catálogo de roles delegables, asignación/revocación y contraseñas                         |
| Sucursales        | Directorio y alta con ubicación aprobada de la empresa                                                            |
| Mi cuenta         | Datos, contraseña propia cuando el restablecimiento administrativo está autorizado y cierre de todas las sesiones |

Las rutas y acciones se protegen por permisos. Los solicitantes y motoristas sin permisos administrativos no pueden entrar. Los reportes requieren conjuntamente `repartidor.ver`, `reporte.ver`, `solicitud.ver`, `jornada.ver` y `evidencia.ver`. Django decide siempre la autorización y el alcance definitivos.

Se distinguen actividad del día y carga actual; cero y `null`; kilómetros medidos, consolidados e incompletos de jornadas cerradas. Los hitos y artículos no se suman para inventar cantidades. La capacidad y los límites los calcula el backend. Las tablas y selectores consultan una página del servidor cada vez.

Las respuestas se validan con Zod. Los errores por campo conservan los valores del formulario; se distinguen HTTP 400, 401, 403, 404, 409, 429 y 5xx de fallos de conexión. Ninguna operación de escritura se repite automáticamente.

## Sesión JWT y contraseñas

React llama a `iniciar-sesion/` de Django con `correo` y `contrasena`. Guarda juntos el access token, el refresh token, sus expiraciones y el identificador de sesión en `sessionStorage`, separados por origen del backend Corporate. No se guardan contraseñas ni se utiliza `localStorage`. Si el navegador bloquea el almacenamiento, la sesión permanece solo en memoria y no se recupera tras recargar.

Las consultas protegidas llevan `Authorization: Bearer`. Las peticiones usan `credentials: omit`, sin autenticación por cookies. Al recargar, se vuelve a consultar `mi-perfil/`; no se confía en permisos persistidos.

La renovación usa las expiraciones recibidas de Django, sustituye conjuntamente ambos tokens y coordina las peticiones concurrentes de esta pestaña con una sola renovación. Solo un GET puede repetirse una vez tras un 401. Un fallo de renovación elimina las credenciales y exige iniciar sesión. Las respuestas pendientes de una sesión anterior no pueden restaurarla ni sobrescribir un acceso nuevo.

La sesión se conserva en la pestaña. No se ofrece una sesión compartida automática entre pestañas; Django determina la revocación de las demás sesiones y cualquier consulta posterior con credenciales revocadas exige nuevo acceso. Los JWT son accesibles al JavaScript de la aplicación, como corresponde a este cliente directo.

El cierre actual utiliza `cerrar-sesion/` y elimina las credenciales tras el 204. Si no hay conexión, la pantalla permite salir localmente, sin afirmar que Django haya revocado la sesión. El cierre de todas las sesiones y el cambio autorizado de contraseña propia también eliminan las credenciales locales.

El contrato ofrece restablecimiento administrativo de contraseña, que revoca las sesiones. No ofrece recuperación pública por correo ni cambio personal con contraseña anterior; no se inventan esos endpoints. Ver [contratos comprobados](./CONTRATOS_WEB_VERIFICADOS.md).

## Verificación

```powershell
npm test
npm run build
npm run test:e2e
npm run format:check
```

Las pruebas cubren contratos, permisos, errores, paginación y operaciones administrativas. Los escenarios de sesión sirven una compilación estática y acceden a una API HTTP de prueba en otro origen: comprueban CORS, Bearer, recuperación, renovación, salida y cambio de contraseña sin cookies ni servidor de sesiones. Las pruebas de escritura no modifican bases operativas.

Resultado de esta adaptación: **35 pruebas unitarias y 33 escenarios de navegador aprobados**, además de compilación y formato.

Las capturas en `artifacts/` contienen datos de prueba. Se comprobó desde el dominio público de Vercel que Django responde a salud, perfil sin sesión y login vacío con CORS correcto. Falta publicar esta actualización y verificar el acceso con una cuenta administrativa real. Ver [diagnóstico de conexión](./deploy/README.md). No se han publicado cambios externos desde esta entrega.

Para revisar la compilación localmente:

```powershell
npm run build
npm run preview
```

Corporate y Network mantienen dominios, bases, sesiones y configuración independientes. Se conserva la identidad Corporate, con la marca del móvil, Manrope y DM Sans y alternativas locales. Ver [revisión](./REVISION_FRONTEND.md).
