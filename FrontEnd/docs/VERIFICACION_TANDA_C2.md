# Verificación en navegador — Tanda C2 (ExportButton: Pedidos, Suscripción, Usuarios, Reposición)

Checklist para Leandro. Esta tanda agrega `ExportButton` a 4 listados que no lo tenían, reusando la arquitectura de exportación asíncrona ya existente (ADR-004, Tanda 6 de la corrida completa) — ningún archivo de esa arquitectura se tocó.

| # | Paso | Resultado esperado |
|---|---|---|
| 1 | Ir a **Pedidos**. Aplicar un filtro (ej. estado "Pendiente" o una búsqueda de texto). Click en "Exportar" → Excel. | El progreso se muestra en el botón, termina en descarga real. Las filas del archivo coinciden con lo que se ve filtrado en pantalla, no con todos los pedidos. |
| 2 | Repetir en Pedidos con formato CSV. | Mismo resultado, formato CSV, acentos/ñ legibles al abrir en Excel. |
| 3 | Ir a **Settings → Suscripción**. Click en "Exportar" (junto al título "Suscripción y Facturación SaaS"). | Exporta el historial de cobros completo (esta vista no tiene filtros propios más allá de la paginación). |
| 4 | Ir a **Settings → Usuarios y Roles**. Click en "Exportar" (junto a "Nuevo Usuario"). | Exporta el directorio de usuarios completo. |
| 5 | Ir a **Inventario → Reposición**, elegir una sucursal. Click en "Exportar". | Exporta SOLO las sugerencias de la sucursal activa — cambiar de sucursal y exportar de nuevo debe traer un archivo distinto. |
| 6 | En Reposición, ordenar por una columna (ej. "Costo Est.", click en el header) y exportar. | El orden del archivo exportado coincide con el orden visible en pantalla. |
| 7 | Vaciar un listado con un filtro que no matchee nada (ej. buscar un texto inexistente en Pedidos) y exportar. | Mensaje de "no hay datos para exportar", sin archivo generado, sin error de consola. |
| 8 | Confirmar que "Generar OC" en Reposición sigue funcionando igual que antes (no se tocó ese flujo en esta tanda). | Genera/agrega a una orden de compra en Compras, como siempre. |

## Nota

Esta tanda corrió en paralelo con la Tanda C1 (ExportButton en Caja, Directorio de Clientes, Movimientos, Historial de Producto, Stock Actual) sobre el mismo working tree — los 9 listados juntos cubren el 100% de lo que `AUDIT_2026-09-07_conexion-export-3fg.md` identificó como pendiente.
