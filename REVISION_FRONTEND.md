# Revisión del frontend Corporate · 2026-10-27

## Resultado de esta entrega

Se aplicaron Frontend Design y UI/UX Pro Max. Se conservó la identidad Corporate, se aumentó la legibilidad, se retiraron rótulos ornamentales y se definió el [sistema visual](./design-system/vitago-corporate/MASTER.md). El alcance permanece en el proyecto web.

Los reportes existentes se conservaron y los módulos antes previstos ahora tienen pantallas funcionales:

| Módulo            | Disponible                                                                             |
| ----------------- | -------------------------------------------------------------------------------------- |
| Resúmenes diarios | Filtros, páginas remotas, detalle, actividad histórica, carga actual y temperaturas    |
| Solicitudes       | Grupos por sucursal/persona, grupo sin sucursal, filtros, creador, detalle e historial |
| Evidencias        | Metadatos, temperatura y consulta de imagen protegida por solicitud                    |
| Motoristas        | Directorio, alta de perfil y motocicleta, carga actual y edición autorizada del límite |
| Usuarios          | Alta, detalle, edición, roles delegables, asignación/revocación y contraseñas          |
| Sucursales        | Directorio y alta con ubicación aprobada de la empresa                                 |

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

- 35 pruebas unitarias aprobadas de contratos, cliente JWT, permisos y reglas de presentación.
- 33 escenarios de navegador aprobados en Chrome, incluyendo compilación estática y API de prueba en otro origen con CORS real.
- Compilación TypeScript/Vite y formato comprobados.
- Capturas de escritorio/tablet inspeccionadas, con comprobación de ausencia de desbordamiento del documento; las tablas conservan su propio desplazamiento.
- Backend real a través del proxy: salud 200; sin credenciales, resúmenes, motoristas, agrupaciones y usuarios 401.

Las pruebas automatizadas de edición modifican únicamente respuestas aisladas dentro de Playwright. No se guardaron cambios en usuarios, límites, solicitudes o evidencias de las bases operativas.

El usuario confirmó una sesión abierta. Computer Use se detuvo al no poder identificar de forma segura la URL de Chrome; no se siguió interactuando con esa ventana, ni se extrajeron sus credenciales. Queda pendiente comprobar visualmente las pantallas nuevas con esa sesión real.

## Flujos completados en esta ampliación

1. Alta de usuarios y gestión de roles. La envoltura y los campos de roles asignables se comprobaron leyendo la vista y el serializador del backend, sin modificarlos. La evidencia se registra en `CONTRATOS_WEB_VERIFICADOS.md`.
2. Restablecimiento administrativo de contraseñas y cambio de la propia cuenta cuando está autorizado por esa misma API. Incluye confirmación de contraseña y cierre de sesiones; no crea una API pública de recuperación inexistente.
3. Alta de sucursales con selector paginado de ubicaciones aprobadas; alta de perfiles de motorista y registro de motocicletas.
4. Asignación/reasignación, corrección de tubos y cancelación de solicitudes con motivo y validación definitiva en Django.
5. Autenticación directa de React a Django mediante JWT, conservando las rutas oficiales y sus errores. El par se guarda en sessionStorage por backend Corporate; la renovación se coordina dentro de la pestaña y las operaciones de escritura no se repiten. La salida o el cambio de contraseña propia eliminan las credenciales; las respuestas pendientes no pueden restaurarlas.
6. Publicación estática en Vercel, con reescritura de rutas React y encabezados en `vercel.json`. Se retiraron el servidor Node de sesiones, las cookies del panel, sus pruebas y las variables privadas asociadas. Node queda como herramienta de desarrollo, compilación y pruebas.

## Dependencias externas y límites restantes

- Validación de datos autenticados reales con la cuenta del usuario: no se completó mediante la herramienta de Chrome por la limitación de identificación de URL indicada arriba.
- El frontend está publicado en `https://frontend-web-eight-self.vercel.app`, conectado con `https://vitago.onrender.com` mediante JWT directo. La publicación del 27 de octubre corrigió el origen compilado y las rutas internas: salud 200, perfil anónimo 401, login vacío 400 con CORS, y rutas de React 200. La evidencia y el diagnóstico histórico están en `deploy/README.md`. Sigue pendiente comprobar una sesión administrativa real.
- Los JWT se guardan en sessionStorage y son accesibles al JavaScript de la aplicación. La recuperación corresponde a la pestaña; no se ofrece la sesión compartida automática del servidor anterior. Si Django revoca otras sesiones, sus siguientes consultas exigirán un nuevo acceso.
- El contrato no ofrece recuperación por correo, cambio personal con contraseña anterior ni edición de sucursales existentes. Esos endpoints requieren ampliación por el equipo del backend; no se han inventado.

## Ampliación administrativa · 2026-10-28

- Entrada Administración con accesos visibles a crear solicitudes, usuarios, sucursales, ubicaciones, motocicletas y motoristas, según permisos.
- Creación de solicitudes con catálogos de origen/destino por modalidad, servicios, prioridades, cantidad de tubos y varios artículos. El resultado refleja la asignación automática del servidor. Se conservan valores y errores por campo tras un rechazo.
- Empresas con datos de contacto y accesos a sus directorios; ubicaciones con alta manual, país de la empresa, coordenadas y aprobación; flota con directorio y alta independiente de motocicletas.
- Las credenciales, el contrato JWT y los permisos de Django permanecen vigentes. Consultar catálogos operativos no concede acceso administrativo. Los botones de reintento dentro de formularios no disparan su envío.
- Capturas verificadas en escritorio, tablet y teléfono. Compilación, 36 pruebas unitarias y 41 escenarios completos de navegador aprobados; la revisión final de formularios incluye además la regresión del reintento.
- No se modificaron backend ni móvil. La API no ofrece alta/edición de empresas, edición de sucursales o vehículos existentes, ni cambio de usuario o motocicleta de un motorista creado.
