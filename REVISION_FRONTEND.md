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
- Rutas y navegación exigen los mismos permisos. Ver motoristas o administrarlos no habilita editar la configuración compartida; ver usuarios no habilita editar cuentas.
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
- No se modificaron backend ni móvil. La API no ofrece alta/edición de datos generales de empresa, edición de sucursales o vehículos existentes, ni cambio de usuario o motocicleta de un motorista creado. La actualización 0.41.0 añade un subrecurso de límites compartidos.

## Adaptación local al contrato 0.41.0

Se sustituyó la edición individual por una pantalla de límites compartidos enlazada desde Administración, Empresas y Motoristas. Corporate utiliza configuración por empresa; Network usa la general tras comprobar el alcance devuelto. La autorización distingue empresa completa, sucursal y permiso global de configuración. Cada motorista conserva su propio cupo calculado.

Se actualizaron los contratos y las pruebas para exigir las nuevas rutas, impedir el PATCH individual, conservar errores 400/403/409, refrescar lecturas y representar un endpoint todavía no disponible. No se usa Git ni se publica esta adaptación. El backend y la migración externa se mantienen fuera del alcance de este trabajo.

Validación final: 40 pruebas unitarias, 50 escenarios de navegador, compilación y formato aprobados. Se inspeccionaron las capturas de límites compartidos en escritorio y teléfono; las pruebas también comprueban tablet y ausencia de desbordamiento del documento. Todas las escrituras se ejecutaron contra respuestas aisladas de prueba.

## Adaptación responsive local · 2026-10-28

- Menú plegable hasta 1024 píxeles, con desplazamiento propio, cierre con Escape, retorno del foco y recuperación del contenido al pasar a escritorio.
- Formularios y filtros en una columna en teléfonos; columnas flexibles, cabeceras y acciones que admiten varias líneas y nombres largos.
- Tablas con desplazamiento horizontal propio. Se corrigió el caption de resúmenes que extendía el ancho del documento y se añadieron regiones accesibles al historial de roles y los artículos declarados.
- Controles de al menos 44 píxeles de alto y campos de 16 píxeles en pantallas pequeñas o con puntero táctil. Márgenes para zonas seguras y acceso desplazable con poco alto disponible.
- Cobertura responsive de 17 pantallas en diez anchos, de 320 a 2560 píxeles, además de navegación táctil, teclado, orientación horizontal y escala de texto del sistema. Capturas en `artifacts/responsive/`.

Validación: 40 pruebas unitarias, diez escenarios de tamaños y 56 escenarios de interacción y regresión aprobados; compilación y formato correctos. Se inspeccionaron capturas de teléfono, tableta, escritorio y horizontal. La simulación se realizó en Chrome con una API de prueba, sin escrituras operativas.

Cambios locales del frontend web. Sin operaciones Git, modificaciones del backend o del móvil, ni publicación.

## Monitorear · Google Maps · 2026-10-28

Se añadió `/monitorear`, con accesos desde Administración y la navegación. Requiere los permisos oficiales de lectura de motoristas, solicitudes y seguimiento. Muestra un marcador por motorista con GPS operativo autorizado y una ficha con carga actual, cupo, solicitudes visibles, artículos, contacto y vehículo. La fecha de captura siempre distingue la última ubicación reportada de una posición confirmada en este instante.

La implementación usa Maps JavaScript API con Advanced Markers y `@vis.gl/react-google-maps` 1.10.1, cargados únicamente al abrir esta sección. No utiliza trazados, Routes, Roads, Geocoding ni Fleet Engine. Los puntos vienen de `/solicitudes/{id}/seguimiento/`; el contrato no permite ubicación libre fuera de solicitudes activas. Se recorren los listados paginados, se agrupan los resultados por motorista y se conserva un solo punto válido, el más reciente. No se inventa un endpoint de GPS general ni se infiere una posición desde evidencias históricas.

La actualización se repite después de 15 segundos, sin ciclos solapados; admite pausa y reintento manual, cancela lecturas al salir u ocultar la pestaña y detiene la repetición ante fallos. Las coordenadas se validan, se comprueba la correspondencia de solicitud/motorista y se retiran puntos que dejan de estar disponibles. La carga total sigue siendo la calculada por Django. Los artículos se consultan solo para la ficha seleccionada.

La clave web se configura en `.env.local` y debe configurarse también en el entorno Production de Vercel antes de una futura publicación. No se imprime ni se copia a archivos de prueba. Se cambió `Referrer-Policy` a `strict-origin-when-cross-origin` para permitir validar la clave restringida por sitio web. Se conserva la atribución del mapa y se enlazan términos y privacidad de Google. Se revisaron las guías y condiciones de Google Maps; no se copiaron fragmentos de sus ejemplos.

Validación: 53 pruebas unitarias y 62 escenarios de navegador de funcionalidad y regresión aprobados, además de compilación y formato. Las pruebas de mapas ejecutan el SDK React con un servicio externo simulado, verificando selección del punto, ficha, errores, retirada de ubicaciones, permisos y adaptación a 320, 375, 820, 1440 y 844 píxeles en horizontal. Capturas identificadas como simulación en `artifacts/monitoreo/`.

El usuario probará el mapa real en Vercel y mantiene la clave restringida a ese sitio; no se hizo una llamada real al mapa desde el origen local ni se comprobó una sesión administrativa real contra la API operativa. Cambios locales, sin publicación, Git, backend ni móvil.

## Almuerzo administrativo · contrato 0.42.0 · 2026-10-29

Se incorporó la entrega completa del contrato adjunto. El directorio de Motoristas envía `en_almuerzo=true/false` junto con los filtros existentes, conserva la empresa y reinicia la página al aplicar un filtro. Muestra una columna con el indicador explícito y la hora `almuerzo_iniciado_en`. Monitorear permite filtrar los registros autorizados ya cargados y representa el mismo indicador en listado y ficha. Una ficha excluida por el filtro deja de mostrarse.

`PAUSED` sigue siendo una pausa genérica: no se deduce almuerzo desde ese estado. Se validan los campos nuevos como booleano y fecha ISO 8601 nullable, manteniéndolos opcionales durante la transición del backend. Su ausencia muestra «Sin información de almuerzo», excluida del filtro «Fuera de almuerzo». Si un servidor anterior devuelve campos ausentes al solicitar el filtro remoto, se indica que no se pudo confirmar su aplicación. La hora mostrada conserva fecha y offset del servidor.

La adaptación es de consulta administrativa: no añade controles ni POST para iniciar o finalizar almuerzos ajenos, ni PATCH de regreso, ni creación de jornadas. Los cierres de las 22:00 y sus guardas corresponden a Django; no se ejecutan reglas de cierre con el reloj del navegador. El contrato informa que el despliegue, la migración externa 0004 y el mantenimiento de 0.42.0 siguen pendientes en Render. Estas tareas permanecen fuera del frontend.

Validación: 59 pruebas unitarias y 18 escenarios de navegador de almuerzos y regresión de administración/monitoreo aprobados; compilación y formato correctos. Se verifican filtros, empresa/paginación, pausa genérica, respuesta anterior al despliegue, actualización del estado y ausencia de escrituras de almuerzo. Capturas de escritorio, tableta y móvil inspeccionadas en `artifacts/almuerzos/`. API y mapas simulados, sin consumos de Google ni cambios en datos operativos.

Cambios locales, sin Git, publicación ni modificaciones de backend, móvil, entornos o credenciales.

## Tubos/frascos y recuperación · contrato 0.43.0–0.44.0 · 2026-10-30

Se incorporó el contrato adjunto completo de 0.44.0. El alta declara tubos y frascos independientes, ambos 0..2147483647 y al menos uno positivo. Se retiran controles y payload de artículos, incluido el manejo de errores por índice. La validación conserva los errores por cantidad y los valores ante HTTP 400/409. No se habilita el alta pendiente de Network.

Los listados y detalles de solicitudes, el directorio de motoristas, los resúmenes y Monitorear muestran frascos por separado. La carga y los cupos se leen de Django sin calcular disponibilidad en el cliente. Los acumulados de reportes no se limitan al máximo de una solicitud. Null histórico y campos nuevos ausentes durante el despliegue muestran «No registrado», sin sustituirlos por cero ni convertir artículos antiguos a recipientes. Los artículos anteriores quedan en una tabla de historia con referencia, condición y notas; desde Monitorear se enlaza a ese detalle.

La configuración EMPRESA/RED incorpora límite de frascos con el mismo alcance y permisos existentes. No se configura desde perfiles individuales. El PATCH de corrección usa `/carga/`, motivo y las cantidades editables: tras la recolección solo permite completar desconocidos y omite los valores conocidos; las terminales no ofrecen modificaciones. Una carga desconocida debe completarse antes de asignar, y disponibles recibe ambos conteos, incluso ceros.

El 503 `CIERRE_OPERATIVO_PENDIENTE` muestra preparación temporal y respeta Retry-After con un plazo monotónico, conservando datos y JWT, también durante renovación. No se repiten escrituras. Durante la espera el cliente bloquea nuevas peticiones y los controles de reintento quedan deshabilitados. En Monitorear este 503 se propaga aunque ocurra al leer GPS, retira los puntos y permite reintentar después; no se confunde con una ubicación ausente.

La entrega nueva confirma que el backend ya aplicó externamente la migración de almuerzo 0004. Las dos migraciones de tubos/frascos siguen pendientes externamente según el documento, junto con publicación coordinada del backend 0.43/0.44 y frontend. No se realizan esas operaciones desde este trabajo.

Las capturas de alta, límites, directorio y resumen están en `artifacts/carga/`, a 320, 820 y 1440 píxeles. Se inspeccionaron teléfono, tableta y escritorio y se comprobó ausencia de desbordamiento del documento. Las pruebas usan API y mapas simulados; Google Maps real y la API de Render no se consultan.

Compilación TypeScript/Vite correcta; aviso no bloqueante de Vite por chunk principal de 501.70 kB (145.41 kB gzip). Cambios locales del frontend web, sin publicación, operaciones Git, cambios de backend/móvil ni modificaciones de entorno o credenciales.

Validación final: **71 pruebas unitarias y 53 escenarios distintos de navegador aprobados** en las ejecuciones de administración, alta, carga/503, asignación, límites compartidos y monitoreo. Las dos pruebas nuevas de alta se corrigieron para localizar los controles por rol; los errores de campo se localizan sin exigir que desaparezca su texto del nombre accesible. La revisión del mapa usa los conteos actuales y consulta artículos como historial. No se ejecutó la comprobación opcional de Google Maps real. Compilación y formato correctos.
