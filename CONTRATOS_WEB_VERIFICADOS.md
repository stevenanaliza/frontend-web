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

Las expiraciones recibidas coordinan la renovación; no hay duraciones JWT fijadas en el frontend. Las peticiones concurrentes de la pestaña comparten una renovación. GET puede repetirse una vez después de un 401; POST, PATCH y DELETE no se repiten automáticamente. Un 403 o 409 conserva los errores del backend y no dispara renovación. Los fallos de renovación eliminan las credenciales, salvo el 503 identificado de recuperación operativa, que conserva la sesión durante Retry-After.

El cliente rechaza rutas ajenas y redirecciones. Las imágenes privadas se descargan con Bearer, se valida el MIME y se liberan los object URLs al dejar de utilizarlos. La salida local invalida también las respuestas y renovaciones pendientes, para que no restauren una sesión finalizada ni borren un acceso nuevo.

## Administración ampliada · 2026-10-28

Se verificaron por lectura los endpoints de organizaciones, ubicaciones y flota, además de `SerializadorCreacionSolicitud` y `SerializadorArticuloCreacion`. No se modificó Django.

- Las solicitudes nuevas usan `opciones-creacion/`, `tipos-servicio/` y `POST /api/v1/solicitudes/`. Desde 0.44.0 se envían `cantidad_tubos` y `cantidad_frascos`, ambos enteros no negativos y con carga no vacía; no se envía `articulos`. El origen y destino enviados son IDs de ubicación, mientras que `sucursal_id` procede del origen autorizado. Los especiales solo se ofrecen cuando Django los incluye y autoriza; no se envía un destino registrado para ellos.
- La ubicación manual usa `origen: REGISTRADA_USUARIO`, país de la empresa cuando se puede consultar, tipo del catálogo y coordenadas con seis decimales. Su alta requiere `ubicacion.crear`. La aprobación requiere `ubicacion.aprobar` y llama a la ruta con `ubicacion.id`, no con el ID de la relación. El estado devuelto por Django determina la aprobación efectiva.
- Las empresas exponen GET de lista y detalle; las sucursales admiten GET y POST; los vehículos admiten GET y POST. No existen POST/PATCH de datos generales de empresa ni PATCH de sucursales o vehículos en las vistas actuales. El permiso `empresa.administrar` por sí solo no añade esas operaciones HTTP; 0.41.0 sí ofrece el subrecurso de límites de motoristas.
- El registro de motocicletas es accesible desde su módulo y desde el alta de motorista. La capacidad operativa sigue calculándose en Django; no se envía `capacidad_carga_kg`.

## Límites compartidos · 0.41.0

Se incorporó el contrato adjunto actualizado el 28 de octubre de 2026. El panel elimina el formulario y todas las escrituras de límites mediante `PATCH /api/v1/repartidores/{id}/`.

- Corporate utiliza GET/PATCH de `organizaciones/empresas/{empresa_id}/limites-motoristas/`. Se valida el `empresa_id` devuelto y se requiere alcance completo de empresa o global para ofrecer edición, además de `empresa.administrar`. Django mantiene la autorización definitiva.
- Un resultado `alcance: RED` redirige la consulta al subrecurso general `organizaciones/configuracion/limites-motoristas/`. Nunca se aplica PATCH de empresa para cambiar la red. La edición general exige `configuracion.administrar` y un rol con alcance GLOBAL; los administradores de clientes solo consultan.
- Los schemas aceptan enteros positivos de tubos hasta 2147483647 y solicitudes entre 1 y 5, diferenciando EMPRESA/RED. El formulario admite motivo opcional hasta 1000 caracteres y envía ambos límites. Se muestra la respuesta validada, sin calcular ni redistribuir cupos en el cliente.
- Se invalidan consultas activas relacionadas al guardar; los cupos individuales de listados y resúmenes continúan siendo los calculados por Django. Las vistas que se abren después hacen GET nuevos. El perfil JWT y las credenciales no cambian.
- El nuevo atributo `limites_motoristas` de las empresas es opcional al leer directorios para conservar consulta con despliegues anteriores. No se sustituye por 20/5 si falta. El endpoint de configuración sí debe responder con el contrato completo; 404 muestra indisponibilidad explícita sin fallback individual.

En esta adaptación del frontend no se aplicaron migraciones, cambios de backend/móvil, modificaciones de entorno ni publicaciones. La entrega posterior del contrato 0.42.0 confirma que el equipo del backend ya aplicó `organizaciones.0003_limites_motoristas_compartidos` externamente y publicó 0.41.0; no se repite esa operación desde esta web.

## Almuerzo administrativo · 0.42.0 · 2026-10-29

Se incorporó el contrato adjunto completo. `GET /api/v1/repartidores/?en_almuerzo=true/false` mantiene `repartidor.ver`, los alcances existentes, el filtro de empresa y la paginación en español. El directorio envía ese parámetro; Monitorear filtra los registros autorizados ya consultados.

Los schemas conservan `en_almuerzo` y `almuerzo_iniciado_en` como booleano y fecha ISO 8601 nullable, respectivamente. Ambos son opcionales para poder consultar despliegues anteriores a 0.42.0: su ausencia significa información no disponible, sin sustituirla por false/null. Un estado `PAUSED` no prueba que exista un almuerzo. La UI utiliza el indicador explícito y conserva el offset horario recibido.

El panel no llama a `jornadas/{id}/almuerzo/iniciar/` o `finalizar/`: están reservados al propietario de la jornada. Tampoco simula regreso mediante PATCH operativo ni crea jornadas adicionales. Las reglas de corte, disponibilidad y asignación corresponden al servidor; no se ejecutan cierres desde el reloj de la web. No se cambian permisos ni roles.

La entrega del 30 de octubre confirma la aplicación externa de `jornadas.0004_horario_diario_almuerzos`; se actualiza el diagnóstico anterior. La publicación y el mantenimiento del servidor se verifican por separado por el equipo del backend.

## Publicación estática

La salida es `dist/`, servida por Vercel. Node se utiliza como herramienta de compilación y pruebas, sin proceso del panel en producción. Los errores de CORS solo pueden corregirse autorizando el origen del panel en el backend; el frontend no agrega permisos CORS ficticios.

El proxy opcional de Vite funciona únicamente durante el desarrollo local. Reenvía peticiones y no gestiona sesiones. La configuración publicada siempre consulta directamente Django.

## Tubos/frascos y recuperación · 0.43.0–0.44.0 · 2026-10-30

- POST de solicitudes: dos conteos explícitos 0..2147483647, al menos uno positivo. Sin formulario ni payload de artículos. La respuesta normal mantiene la asignación decidida por Django.
- Detalle: `articulos_historicos` de solo lectura, conservando referencia, condición y notas. La lectura antigua `articulos` se acepta como historial durante la transición, nunca como conteos ni entrada de creación.
- Corrección: PATCH `/solicitudes/{id}/carga/`, permiso `solicitud.asignar`, motivo obligatorio. Después de recoger solo se ofrecen cantidades desconocidas; las conocidas se omiten y se conservan. Las terminales no ofrecen cambios. No se usa la ruta obsoleta de cantidad-tubos.
- Disponibles: query de tubos y frascos, incluidos ceros explícitos. No se ofrecen asignaciones con una carga sin registrar. La validación definitiva de cupos, GPS y alcance sigue en Django.
- Límites: se incorpora `limite_frascos` al mismo GET/PATCH compartido, permisos y alcance EMPRESA/RED existentes. No se agregan límites al perfil individual. Campos nuevos de lectura opcionales por despliegue pendiente, sin valores por defecto.
- Motoristas, Monitorear y resúmenes: conservan campos de frascos independientes de tubos. Los históricos null y la ausencia de campos se muestran como «No registrado». Los resúmenes muestran conocidos y operaciones sin cantidad por separado.
- 503 `CIERRE_OPERATIVO_PENDIENTE`: mensaje de preparación, plazo monotónico de Retry-After, reintento manual después de la espera, bloqueo temporal compartido de peticiones y conservación de JWT ante la renovación temporalmente indisponible. No se repiten POST/PATCH automáticamente.

La entrega oficial informa que `organizaciones.0004_tubos_frascos_sin_articulos` y `solicitudes.0009_tubos_frascos_sin_articulos` solo están aplicadas localmente en el backend. No se verifican ni ejecutan migraciones externas desde este proyecto. La publicación coordinada de 0.43/0.44 en Render y Vercel queda pendiente. Pruebas de esta adaptación con respuestas simuladas, sin consultas ni escrituras contra Render o Google.

## Acceso administrativo a almuerzos · 2026-10-30

Se añade `/almuerzos`, accesible desde menú y Administración con `repartidor.ver` y la protección administrativa existente. Usa el mismo GET paginado de motoristas, filtro `en_almuerzo`, empresa y perfil; muestra estado actual y hora de inicio conservando su offset. No exige permisos de reportes ni de seguimiento GPS. Los datos ausentes permanecen desconocidos y se advierte si el servidor no confirma el filtro. No incorpora escrituras ni acciones de jornada/almuerzo; no se cambia el backend.
