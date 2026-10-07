# 06 — Cobertura de los 83 RF del Documento 04

**Verificado el 2026-10-07** contra `Documentacion/negocio/Documento-04-Plan-Maestro-de-Requerimientos-y-Tareas-de-Implementacion.md` (83 encabezados `### RF-`) y contra la tabla de `01_ENDPOINTS.md`. Los números de la columna "Endpoints" son las filas de esa tabla (`#42` = `createOrder`).

**Criterio de cobertura:**
- **completo:** hay contrato para el alcance funcional del RF tal como está escrito.
- **parcial:** hay endpoint, pero falta una parte que el RF pide explícitamente. Lo que falta va en la nota.
- **sin contrato:** no hay endpoint. Como mucho hay un campo suelto en otra entidad.

Esto mide **contrato**, no calidad de la implementación.

| RF | Módulo | Etapa | Endpoints (01) | Cobertura | Falta / nota |
|---|---|---|---|---|---|
| RF-ORG-001 | Organización | MVP | — | sin contrato | `Company` solo existe dentro de la sesión (`session.types.ts:24`) |
| RF-ORG-002 | Organización | MVP | — | sin contrato | sucursales solo dentro de la sesión, sin ABM; no hay depósitos |
| RF-ORG-003 | Organización | MVP | — | sin contrato | sin parámetros del sistema (el IVA 21% está hardcodeado en la UI) |
| RF-ORG-004 | Organización | Crecimiento | — | sin contrato | |
| RF-IAM-001 | IAM | MVP | #49, #50 | parcial | solo listado y export, sin ABM |
| RF-IAM-002 | IAM | MVP | #51, #52 | parcial | matriz por módulo, sin acción, **sin enforcement** (04 §3) |
| RF-IAM-003 | IAM | MVP | — | sin contrato | `UserAccount.status` existe sin endpoint |
| RF-IAM-004 | IAM | Enterprise | — | sin contrato | no hay auth (04 §1) |
| RF-CLI-001 | Clientes | MVP | #4, #5, #7, #8, #9 | parcial | sin validación de CUIT ni unicidad (03, R-CLI-1); baja vía `isActive` en update |
| RF-CLI-002 | Clientes | MVP | #8, #9 | parcial | `creditLimit`, `priceList`, `saleCondition` como texto o número; **el límite no se aplica** |
| RF-CLI-003 | Clientes | MVP | #10, #12 | parcial | sin historial de pedidos por cliente (no hay filtro `clientId` en #40) |
| RF-CLI-004 | Clientes | MVP | #9, #12, #13 | parcial | `isActive` aplicado al alta de pedido (Tanda 17); sin bloqueo por morosidad |
| RF-CLI-005 | Clientes | Crecimiento | #8, #9 | parcial | una sola dirección de entrega, y sin consumidor (`PENDIENTES.md` #16) |
| RF-CLI-006 | Clientes | Crecimiento | #4 | parcial | `zone` y `businessCategory` como texto; filtro por zona |
| RF-PRO-001 | Proveedores | MVP | #53–#57 | parcial | sin baja |
| RF-PRO-002 | Proveedores | MVP | #56, #57 | parcial | `paymentTerms` en texto |
| RF-PRO-003 | Proveedores | Crecimiento | — | sin contrato | |
| RF-PRO-004 | Proveedores | Crecimiento | #56, #57 | parcial | un solo contacto embebido |
| RF-CAT-001 | Catálogo | MVP | — | sin contrato | `category` en texto (`inventory.types.ts:46`) |
| RF-PRD-001 | Productos | MVP | #78–#81 | parcial | catálogo sin paginar (ADR-016); baja lógica |
| RF-PRD-002 | Productos | MVP | #53, #55 | parcial | `Supplier.products` embebido; un solo `supplierId` por producto |
| RF-PRD-003 | Productos | Crecimiento | — | sin contrato | |
| RF-PRD-004 | Productos | MVP | — | sin contrato | `unitOfMeasure` en texto, sin conversión |
| RF-PRI-001 | Precios | MVP | — | sin contrato | `priceList` en texto; márgenes sueltos en el producto |
| RF-PRI-002 | Precios | MVP | — | sin contrato | |
| RF-PRI-003 | Precios | MVP | — | sin contrato | el descuento por línea existe solo en la UI (`CreateOrderModal`) |
| RF-INV-001 | Inventario | MVP | #82–#86 | parcial | por sucursal; sin vista de "stock universal" entre sucursales; sin disponible = físico − reservado |
| RF-INV-002 | Inventario | MVP | — | sin contrato | `StockAdjustmentModal.tsx` huérfano (`PENDIENTES.md` #11) |
| RF-INV-003 | Inventario | MVP | #15–#18 | parcial | solo lectura: **ninguna operación escribe movimientos** (03, R-INV-1) |
| RF-INV-004 | Inventario | MVP | — | sin contrato | la alerta "transferencia retrasada" apunta a una `Delivery` |
| RF-INV-005 | Inventario | Crecimiento | #78–#80, #69–#71 | parcial | lotes por producto (empresa), no por sucursal; alertas de vencimiento estáticas |
| RF-INV-006 | Inventario | MVP | — | sin contrato | |
| RF-INV-007 | Inventario | MVP | — | sin contrato | sin reservado ni comprometido |
| RF-CMP-001 | Compras | MVP | #63–#68 | parcial | sin número de OC; fusión sin moneda (03, R-CMP-7) |
| RF-CMP-002 | Compras | MVP | #67 | parcial | `received` sin cantidades ni stock; sin estado Parcial (07) |
| RF-CMP-003 | Compras | MVP | — | sin contrato | |
| RF-CMP-004 | Compras | Crecimiento | #19, #20, #68 | parcial | hay sugerencias de reposición, no requisición con aprobación; el "solicitado" vive en el cliente |
| RF-CMP-005 | Compras | MVP | — | sin contrato | |
| RF-CMP-006 | Compras | MVP | — | sin contrato | |
| RF-VEN-001 | Ventas | MVP | — | sin contrato | `comercial: 'Borrador'` existe en el tipo, sin flujo |
| RF-VEN-002 | Ventas | MVP | — | sin contrato | |
| RF-VEN-003 | Ventas | Crecimiento | — | sin contrato | |
| RF-VEN-004 | Ventas | Crecimiento | — | sin contrato | |
| RF-PED-001 | Pedidos | MVP | #42, #45 | parcial | **sin reserva de stock**; precios y totales del cliente (03, R-PED-4) |
| RF-PED-002 | Pedidos | MVP | #43, #25, #26 | parcial | parcial por línea (ADR-001), **no backorder como sub-pedido** (07) |
| RF-PED-003 | Pedidos | MVP | #40, #41 | parcial | filtros de 04 §7; los "semáforos" no están en el contrato |
| RF-PED-004 | Pedidos | MVP | #44 | parcial | cancelación sí; **modificación no** |
| RF-PED-005 | Pedidos | MVP | #40, #45 | parcial | `Order.history` solo lo escribe el alta (02) |
| RF-PRE-001 | Preparación | MVP | — | sin contrato | solo el estado `preparing` |
| RF-PRE-002 | Preparación | MVP | — | sin contrato | |
| RF-PRE-003 | Preparación | MVP | — | sin contrato | |
| RF-PRE-004 | Preparación | Crecimiento | — | sin contrato | |
| RF-LOG-001 | Logística | MVP | #30–#35 | parcial | asignación manual con capacidad (ADR-011); sin ruteo automático (decisión §5) |
| RF-LOG-002 | Logística | MVP | #72–#76, #87–#91 | completo | ABM de vehículos y choferes; el chofer no está vinculado a un usuario |
| RF-LOG-003 | Logística | Crecimiento | #38, #39 | parcial | sin ingesta de GPS; recorrido sintético |
| RF-ENT-001 | Entregas | MVP | #25, #36 | parcial | dos caminos a `FINALIZADO` (03, R-VIA-11); el pedido no se bloquea |
| RF-ENT-002 | Entregas | MVP | #25, #37 | parcial | rechazo por línea; **no reingresa stock** y no hay estado "Rechazado" en el pedido |
| RF-ENT-003 | Entregas | MVP | #24, #37 | completo | con catálogo de motivos (ADR-013) |
| RF-ENT-004 | Entregas | Crecimiento | #36, #29 | parcial | las subidas no tienen contrato HTTP (04 §11) |
| RF-FAC-001 | Facturación | MVP | — | sin contrato | `invoiced` es solo un estado de #43 |
| RF-FAC-002 | Facturación | MVP | — | sin contrato | |
| RF-FAC-003 | Facturación | MVP | — | sin contrato | |
| RF-FAC-004 | Facturación | Crecimiento | — | sin contrato | |
| RF-CCT-001 | Cuenta corriente | MVP | #10–#13 | parcial | solo lectura; ninguna operación escribe la cuenta |
| RF-CCT-002 | Cuenta corriente | MVP | #12 | parcial | FIFO calculado, no se persiste la aplicación |
| RF-CCT-003 | Cuenta corriente | MVP | — | sin contrato | solo `Supplier.currentBalance` |
| RF-TES-001 | Tesorería | MVP | #3 | parcial | movimiento de caja con categoría `cobro`; sin recibo |
| RF-TES-002 | Tesorería | MVP | #1–#3 | parcial | sin entidad Caja, sin cuentas bancarias, sin sucursal |
| RF-TES-003 | Tesorería | MVP | — | sin contrato | |
| RF-TES-004 | Tesorería | MVP | — | sin contrato | |
| RF-TES-005 | Tesorería | MVP | — | sin contrato | `paymentMethod` en el pedido (3 valores) |
| RF-FIN-001 | Finanzas | Crecimiento | — | sin contrato | |
| RF-FIN-002 | Finanzas | Enterprise | — | sin contrato | |
| RF-REP-001 | Reportes | MVP | #14, #58 | parcial | dos fuentes de tablero (01); analítica sin contrato |
| RF-REP-002 | Reportes | MVP | 15 exports (#2, #5, #11, …) | parcial | el archivo se arma en el cliente (01 C-1) |
| RF-REP-003 | Reportes | Crecimiento | — | sin contrato | `analytics.data.ts` estático |
| RF-AUD-001 | Auditoría | MVP | #46 | parcial | **ninguna mutación escribe** (04 §15) |
| RF-AUD-002 | Auditoría | Enterprise | — | sin contrato | |
| RF-NOT-001 | Notificaciones | MVP | #69–#71 | parcial | sin motor de generación; leído global |
| RF-NOT-002 | Notificaciones | Crecimiento | — | sin contrato | |
| RF-INT-001 | Integraciones | MVP | — | sin contrato | |
| RF-INT-002 | Integraciones | Crecimiento | — | sin contrato | |
| RF-INT-003 | Integraciones | Enterprise | — | sin contrato | |

## Totales

Los conteos y su comando de verificación están en `00_RESUMEN.md` (V4).
