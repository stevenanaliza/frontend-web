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

## Administración ampliada · 2026-10-28

Se verificaron por lectura los endpoints de organizaciones, ubicaciones y flota, además de `SerializadorCreacionSolicitud` y `SerializadorArticuloCreacion`. No se modificó Django.

- Las solicitudes nuevas usan `opciones-creacion/`, `tipos-servicio/` y `POST /api/v1/solicitudes/`. `cantidad_tubos` es obligatoria e independiente de `articulos[].cantidad`. El origen y destino enviados son IDs de ubicación, mientras que `sucursal_id` procede del origen autorizado. Los especiales solo se ofrecen cuando Django los incluye y autoriza; no se envía un destino registrado para ellos.
- La ubicación manual usa `origen: REGISTRADA_USUARIO`, país de la empresa cuando se puede consultar, tipo del catálogo y coordenadas con seis decimales. Su alta requiere `ubicacion.crear`. La aprobación requiere `ubicacion.aprobar` y llama a la ruta con `ubicacion.id`, no con el ID de la relación. El estado devuelto por Django determina la aprobación efectiva.
- Las empresas exponen GET de lista y detalle; las sucursales admiten GET y POST; los vehículos admiten GET y POST. No existen POST/PATCH de empresas ni PATCH de sucursales o vehículos en las vistas actuales. El permiso `empresa.administrar` por sí solo no añade esas operaciones HTTP.
- El registro de motocicletas es accesible desde su módulo y desde el alta de motorista. La capacidad operativa sigue calculándose en Django; no se envía `capacidad_carga_kg`.

## Publicación estática

La salida es `dist/`, servida por Vercel. Node se utiliza como herramienta de compilación y pruebas, sin proceso del panel en producción. Los errores de CORS solo pueden corregirse autorizando el origen del panel en el backend; el frontend no agrega permisos CORS ficticios.

El proxy opcional de Vite funciona únicamente durante el desarrollo local. Reenvía peticiones y no gestiona sesiones. La configuración publicada siempre consulta directamente Django.
