# Verificación en navegador — barrido de `empresaId` (sesión 2026-09-08)

Checklist para Leandro. Ningún cambio de esta sesión toca el filtrado real del mock (sigue siendo de una sola empresa, `empresaId` viaja en el contrato pero el mock no lo usa para filtrar — igual que el resto del proyecto). Lo que hay que confirmar es que **nada se rompió** al agregar el parámetro: las 4 pantallas que antes fallaban en `tsc` (Compras, Reposición, Detalle de Proveedor) tienen que seguir funcionando igual que antes.

## 1. Compras — alta de orden (`PurchaseOrderFormModal`, lote 4)

1. Ir a Compras, click "Nueva Orden de Compra".
2. Cargar proveedor, sucursal, al menos un producto con cantidad y precio.
3. "Guardar Borrador": confirmar que la orden aparece en el listado con estado "Borrador", sin error en consola.
4. Repetir con "Emitir Orden de Compra": confirmar estado "Enviada".

## 2. Compras — transición de estado (`ComprasPage`/`TabPendingReceipt`, lote 4)

1. Con una orden en estado "Enviada", ir a la tab "Pendientes de Recepción".
2. Marcar como recibida (o la transición disponible): confirmar que desaparece de "Pendientes" y el toast de éxito aparece.
3. Desde el detalle de una orden en `ComprasPage`, repetir una transición de estado válida.

## 3. Reposición — generar OC desde sugerencia (`TabPurchases`, lote 4)

1. Ir a Inventario → tab Reposición.
2. Click "Generar OC" sobre una sugerencia con proveedor válido.
3. Confirmar que se crea la orden y el toast de éxito aparece (sin quedar colgado en "Generando...").

## 4. Proveedores — historial de compras (`SupplierDetailPanel`, lote 4)

1. Ir a Proveedores, abrir el panel de detalle de un proveedor con órdenes asociadas.
2. Tab "Historial y Deuda": confirmar que la lista de órdenes de compra de ese proveedor carga (antes de esta sesión el `tsc` de este archivo ni compilaba).

## 5. Clientes — Cuentas Corrientes / Morosos (lote 2)

1. Ir a Clientes → tab "Cuentas Corrientes": confirmar que la tabla carga y pagina normalmente.
2. Tab "Clientes Morosos": confirmar que carga y que el Dashboard (`getOverdueTotalsInMoney`, ver abajo) sigue mostrando el mismo total que antes de esta sesión.

## 6. Logística — las 4 acciones de entrega (lote 3)

1. Marcar una entrega "En tránsito" desde `LogisticsPage`.
2. Reprogramar una entrega (`ReprogramarModal`): confirmar que pide motivo y que vuelve a estado "Creada".
3. Registrar una entrega (`RegistrarEntregaModal`): confirmar que se puede completar y que el pedido asociado actualiza su estado de cumplimiento.
4. Abrir el historial de una entrega (`DeliveryHistoryModal`): confirmar que la lista de remitos carga.

## 7. Dashboard (lote 5 + nota de reconciliación)

1. Confirmar que el Dashboard carga sin error (usa `fetchDashboardData`, que ahora exige `empresaId` — si la sesión no cargó todavía, `useDashboard` no dispara el fetch en vez de pedirlo con `empresaId: ''`).
2. Filtrar los agregados por una sucursal puntual (no "Toda la empresa"): confirmar que aparece la nota "Los números de esta sucursal pueden no coincidir con la suma exacta de todas las sucursales...".
3. Confirmar que la nota **desaparece** al volver a "Toda la empresa".

## Qué NO cubre este checklist

No se abrió un navegador durante esta sesión — todo lo de arriba es estático (`tsc`/`build`/smoke scripts). Es la misma limitación que todos los informes anteriores del protocolo. No se verificó el caso borde de crear un pedido nuevo y mirar el Dashboard filtrado por sucursal antes de que Logística le genere su primera entrega (el caso "pedido sin ninguna entrega" documentado en la corrección de ADR-009 — no hay ningún pedido en ese estado en el mock hoy para probarlo directamente).
