# Contratos del panel web comprobados

## Fuente

Los endpoints de Django siguen `VITAGO_API_FRONTEND.md`. Para completar el JSON no ejemplificado de roles asignables se leyeron, sin modificar, `../backend/apps/usuarios/vistas.py` (`VistaRolesAsignables.get`) y `../backend/apps/usuarios/serializadores.py` (`SerializadorRolAsignable`).

`GET /api/v1/usuarios/roles-asignables/` devuelve un objeto con `resultados`, sin paginación. Cada rol tiene `codigo`, `nombre`, `descripcion`, `permite_alcance_global`, `permite_alcance_empresa` y `permite_alcance_sucursal`. La interfaz consulta este catálogo para el alcance seleccionado y nunca fija los roles que puede delegar un administrador.

El restablecimiento está comprobado en `VistaRestablecimientoContrasena` y `restablecer_contrasena_usuario`. Usa `POST /api/v1/usuarios/{id}/restablecer-contrasena/` con `contrasena_temporal`, valida la política de Django y revoca las sesiones. Se usa también para la propia cuenta administrativa cuando el backend autoriza esa operación. **No existe en el contrato actual un cambio personal con contraseña anterior ni una recuperación pública por correo**; no se simulan esas funciones.

## Autenticación directa en Django

El cliente único es `src/api.ts`. No existe un adaptador de sesiones del panel, no se crean rutas `/web/sesion` y no hay traducción de cookies a JWT. El navegador consulta el origen `VITE_API_URL`, agrega las rutas oficiales `/api/v1/` y omite las cookies.

| Endpoint de Django                                      | Comportamiento del cliente                                                                   |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `POST /api/v1/autenticacion/iniciar-sesion/`            | Envía `{correo, contrasena}` y valida el par JWT y las expiraciones de la respuesta oficial. |
| `POST /api/v1/autenticacion/renovar/`                   | Envía `{token_refresco}` sin Bearer y sustituye conjuntamente el access y el refresh token.  |
| `GET /api/v1/usuarios/mi-perfil/`                       | Recupera perfil y permisos con el Bearer vigente después del acceso y al recargar.           |
| `POST /api/v1/autenticacion/cerrar-sesion/`             | Envía Bearer, sin cuerpo; ante 204 elimina credenciales y perfil locales.                    |
| `POST /api/v1/autenticacion/cerrar-todas-las-sesiones/` | Django revoca las sesiones y el panel elimina las credenciales locales tras el éxito.        |

La clave `vitago:corporate:<origen-backend>:sesion` en `sessionStorage` contiene únicamente los campos validados de `tokensSchema`. No contiene contraseña, perfil ni permisos. `localStorage` no almacena tokens. Si el almacenamiento está bloqueado, se conserva solo en memoria.

Las expiraciones recibidas coordinan la renovación; no hay duraciones JWT fijadas en el frontend. Las peticiones concurrentes de la pestaña comparten una renovación. GET puede repetirse una vez después de un 401; POST, PATCH y DELETE no se repiten automáticamente. Un 403 o 409 conserva los errores del backend y no dispara renovación. Cualquier fallo de renovación elimina las credenciales.

El cliente rechaza rutas ajenas y redirecciones. Las imágenes privadas se descargan con Bearer, se valida el MIME y se liberan los object URLs al dejar de utilizarlos. La salida local invalida también las respuestas y renovaciones pendientes, para que no restauren una sesión finalizada ni borren un acceso nuevo.

## Publicación estática

La salida es `dist/`, servida por Vercel. Node se utiliza como herramienta de compilación y pruebas, sin proceso del panel en producción. Los errores de CORS solo pueden corregirse autorizando el origen del panel en el backend; el frontend no agrega permisos CORS ficticios.

El proxy opcional de Vite funciona únicamente durante el desarrollo local. Reenvía peticiones y no gestiona sesiones. La configuración publicada siempre consulta directamente Django.
