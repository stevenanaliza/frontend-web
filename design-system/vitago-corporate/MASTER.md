# VitaGo Corporate: dirección de interfaz

## Producto y propósito

Panel de supervisión del transporte de muestras. Usuarios administrativos en escritorio y tablet, con información por sucursal, solicitante y motorista. La prioridad es distinguir actividad histórica, carga actual y evidencia registrada sin reinterpretar el contrato.

## Sistema visual

| Token            | Valor     | Uso                                            |
| ---------------- | --------- | ---------------------------------------------- |
| Azul Corporate   | `#2D4B77` | Navegación, encabezados y acciones principales |
| Rojo Corporate   | `#D1393D` | Marca y acceso                                 |
| Tinta            | `#203551` | Texto y cifras                                 |
| Texto secundario | `#626B78` | Ayudas y metadatos                             |
| Fondo            | `#F7F8FA` | Área de trabajo                                |
| Superficie       | `#FFFFFF` | Formularios y tablas                           |

Manrope para títulos y cifras destacadas; DM Sans para lectura y formularios. Se conserva la identidad existente y su imagen oficial. Datos de tabla de 13–14 px; ayudas de al menos 12 px. Tablas con números tabulares y alineación de columnas consistente.

## Composición elegida

Contenido alineado a la izquierda. Navegación lateral permanente en escritorio, desplegable con control de foco en tablet. La tabla es el elemento central; filtros y agrupación tienen una posición estable. El rojo se reserva para la identidad; los estados operativos incluyen texto además de color.

```text
Navegación | Título y acción de actualización
           | Filtros y contexto de empresa
           | Selector paginado de sucursal / solicitante
           | Tabla paginada del grupo seleccionado
           | Detalle, evidencia o formulario de límite
```

## Revisión de la propuesta

Se adopta la recomendación Data-Dense Dashboard de UI/UX Pro Max para tablas y filtros. Su composición de landing y paleta genérica no corresponden a esta herramienta; se conservan los colores Corporate. Siguiendo Frontend Design, se retiran los rótulos ornamentales en mayúsculas y el lenguaje comercial del acceso. Se da personalidad con la marca y la jerarquía de datos de muestras, sin añadir gráficos o contadores ficticios.

## Reglas de interacción

- Consultas y paginación en servidor, sin descargar todas las páginas.
- Resumen de errores enfocable y errores por campo junto al control.
- Formularios conservan los valores tras 400/409 y no repiten mutaciones.
- La pantalla de límite muestra la carga devuelta, pide motivo y aplica únicamente la respuesta del servidor.
- Evidencias binarias con Bearer, sin URLs privadas permanentes y con liberación de object URLs.
- Las tablas pueden desplazarse en su región, pero el documento no debe desbordar.
- Teclado, foco visible y movimiento reducido comprobados en escritorio y tablet.
