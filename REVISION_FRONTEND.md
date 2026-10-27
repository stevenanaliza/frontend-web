# Revisión del frontend Corporate · 2026-10-27

## Resultado de esta entrega

Se aplicaron Frontend Design y UI/UX Pro Max. Se conservó la identidad Corporate, se aumentó la legibilidad, se retiraron rótulos ornamentales y se definió el [sistema visual](./design-system/vitago-corporate/MASTER.md). El alcance permanece en el proyecto web.

Los reportes existentes se conservaron y los módulos antes previstos ahora tienen pantallas funcionales:

| Módulo            | Disponible                                                                             |
| ----------------- | -------------------------------------------------------------------------------------- |
| Resúmenes diarios | Filtros, páginas remotas, detalle, actividad histórica, carga actual y temperaturas    |
| Solicitudes       | Grupos por sucursal/persona, grupo sin sucursal, filtros, creador, detalle e historial |
| Evidencias        | Metadatos, temperatura y consulta de imagen protegida por solicitud                    |
| Motoristas        | Directorio, estado/carga actuales y edición autorizada del límite con motivo           |
| Usuarios          | Directorio, detalle, historial de roles y edición autorizada de datos/estado           |
| Sucursales        | Directorio por empresa y selector para cuentas sin empresa de contexto                 |

## Correcciones de la revisión

- `solicitud.ver` se reconoce como permiso administrativo según la sección 19. `ver_propias` y `ver_asignadas` no permiten entrar por sí solos. El inicio lleva al primer módulo autorizado.
- Rutas y navegación exigen los mismos permisos. Ver motoristas no habilita editar límites; ver usuarios no habilita editar cuentas.
- Los filtros y páginas de agrupaciones, solicitudes y evidencias no se envían como parámetros desconocidos a otras API. El grupo sin sucursal utiliza `sin_sucursal=true` y no envía `sucursal_id`.
- Los errores por campo mantienen los valores del formulario y reciben foco; no se repiten automáticamente PATCH/POST.
- Las imágenes privadas se solicitan con Bearer, sin caché, validando JPEG/PNG/WebP y liberando los object URLs. No se usa una URL privada del servidor como imagen pública.
- Se corrigieron identificadores repetidos en los filtros y nombres accesibles ambiguos. La navegación por teclado conserva foco y permite cerrar el menú con Escape.
- Se preservaron null, cero y las cantidades históricas sin declarar. Los artículos descriptivos no se suman a los tubos; los hitos no se suman para fabricar solicitudes únicas.
- Los reportes mantienen su zona operativa recibida. Detalles de solicitudes, roles y evidencias que no publican una zona operativa se etiquetan explícitamente en UTC.

## Evidencia de verificación

- 28 pruebas unitarias aprobadas.
- 18 escenarios de navegador aprobados en Chrome con respuestas de prueba extraídas del documento oficial.
- Compilación TypeScript/Vite y formato comprobados.
- Capturas de escritorio/tablet inspeccionadas, con comprobación de ausencia de desbordamiento del documento; las tablas conservan su propio desplazamiento.
- Backend real a través del proxy: salud 200; sin credenciales, resúmenes, motoristas, agrupaciones y usuarios 401.

Las pruebas automatizadas de edición modifican únicamente respuestas aisladas dentro de Playwright. No se guardaron cambios en usuarios, límites, solicitudes o evidencias de las bases operativas.

El usuario confirmó una sesión abierta. Computer Use se detuvo al no poder identificar de forma segura la URL de Chrome; no se siguió interactuando con esa ventana, ni se extrajeron sus credenciales. Queda pendiente comprobar visualmente las pantallas nuevas con esa sesión real.

## Siguientes pasos y contrato pendiente

1. Validar las pantallas con una cuenta administrativa real y su alcance efectivo.
2. Alta de usuarios y asignación/revocación de roles. El documento describe las entradas y reglas, pero debe incluir un **ejemplo JSON completo de la respuesta** de `GET /api/v1/usuarios/roles-asignables/?tipo_alcance=EMPRESA&empresa_id=<uuid>`, precisando su envoltura y los campos del catálogo, antes de construir el selector sin fijar códigos de roles.
3. Alta de sucursales con selección paginada de una ubicación aprobada para la empresa; el contrato ya está documentado. La edición de sucursales existentes no se implementará mientras no tenga endpoint oficial.
4. Alta de perfiles de motorista y selección de usuario/vehículo permitidos; después, asignación y reasignación de servicios con validación de cupo en backend.
5. Resolver persistencia segura de sesión web y coordinación de pestañas antes de producción. La implementación actual usa `sessionStorage` y la renovación se coordina dentro de cada instancia; la diferencia respecto al almacenamiento seguro nativo sigue documentada en README.
6. Configurar CORS o el proxy del alojamiento productivo y probar el flujo con HTTPS. El proxy de Vite resuelve únicamente el desarrollo local.
