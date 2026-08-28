# Log de Implementación

Changelog de correcciones puntuales de RF sobre el código existente. Un bloque por módulo resuelto, en orden cronológico. No reemplaza a `CONTRADICCIONES.md` (estado vivo de contradicciones), es el detalle de "qué se tocó y cuándo" para poder retomar si una sesión se corta a la mitad.

---

## 2026-08-27 — Clientes (RF-CLI-001) — corrección de C4

**Problema:** `CreateClientModal.handleSave` solo validaba y cerraba el modal, sin persistir nada. `handleSaveAndOrder` disparaba `alert()` nativo.

**Archivos creados:**
- `src/services/mock/clients.service.ts` — `fetchClients` / `createClient` / `updateClient`, store en memoria a partir de `CLIENTS_MOCK_DATA` (mismo patrón que `products.service.ts`).

**Archivos modificados:**
- `src/modules/clients/components/create-client/CreateClientModal.tsx` — agrega props `client`/`onSave`; "Guardar" y "Guardar y Nuevo Pedido" llaman al service (alta si no hay `client`, edición si lo hay); reemplaza el `alert()` por `toast.success` de sonner; agrega estado `isSubmitting` para deshabilitar botones durante el guardado; precarga el formulario en modo edición vía un `useEffect` que solo corre al abrir el modal.
- `src/modules/clients/ClientsPage.tsx` — carga clientes con `fetchClients()` en `useEffect`, mantiene el listado en estado (`clients`) en vez de leer `CLIENTS_MOCK_DATA` directo, agrega `handleSaveClient` y lo pasa como `onSave` al modal.

**Qué quedó persistiendo de verdad:**
- Alta de cliente: aparece en `ClientDirectoryTable` y `ClientAccountsTable` sin recargar.
- Edición de cliente: el service (`updateClient`) soporta editar preservando los campos que el formulario no controla (saldo, transacciones, etc.); el modal acepta un `client` prop para precargar, aunque hoy `ClientsPage` solo abre el modal en modo alta (no hay botón "editar" en la tabla — no se agregó por no estar pedido).

**Fuera de alcance / pendiente:**
- No se migró el formulario a react-hook-form/zod (se mantuvo `useState`, según lo acordado en la tarea para no reescribir los 4 sub-tabs).
- Campos que el formulario captura pero `ClientAccount` no modela (nombre de fantasía, condición IVA, email, dirección de entrega, lista de precios, categoría, notas, activo/inactivo) no se persisten — ver `CONTRADICCIONES.md` C8.
- "Guardar y Nuevo Pedido" sigue sin abrir un pedido real (el mensaje sigue siendo simulado); solo se pidió sacar el `alert()`.

---

## 2026-08-27 — Proveedores (RF-PRO-001) — corrección de C4

**Problema:** El botón "Guardar Proveedor" de `SupplierFormModal` era `onClick={onClose}` — no validaba ni persistía nada. Los inputs eran no controlados (`defaultValue`, sin `onChange`).

**Archivos creados:**
- `src/services/mock/suppliers.service.ts` — `fetchSuppliers` / `createSupplier` / `updateSupplier` (+ `addPurchaseOrder`, usado por el punto de Compras más abajo), store en memoria a partir de `SUPPLIERS_MOCK_DATA`.

**Archivos modificados:**
- `src/modules/suppliers/components/SupplierFormModal.tsx` — inputs pasados a controlados (`name`, `cuit`, `category`, `phone`, `contactEmail`), validación mínima (Razón Social y CUIT obligatorios, sin chequeo de unicidad todavía), "Guardar Proveedor" llama al service (alta o edición según haya `supplier`), `toast.success`/`toast.error` de sonner, precarga en modo edición vía `useEffect` al abrir.
- `src/modules/suppliers/SuppliersPage.tsx` — carga proveedores con `fetchSuppliers()` en estado (`suppliers`), agrega `handleSaveSupplier` y lo pasa como `onSave` al modal; también mantiene sincronizado `selectedSupplier` para que el panel de detalle abierto refleje la edición.

**Qué quedó persistiendo de verdad:**
- Alta y edición de proveedor: aparece/actualiza en `SuppliersTable` sin recargar.

**Fuera de alcance / pendiente:**
- No se agregó validación de unicidad de CUIT (explícitamente pedido dejar para un RF futuro).
- Campos de `Supplier` que el formulario no captura (contactName, address, city, paymentTerms) quedan vacíos/en default al dar de alta — ver `CONTRADICCIONES.md` C8.
- El selector "Condición ante el IVA" del formulario sigue sin persistirse (no existe en el tipo `Supplier`).

---

## 2026-08-27 — Compras / Órdenes de Compra (RF-CMP-001, alcance frontend) — corrección de C4

**Problema:** El botón "Emitir Orden de Compra" de `PurchaseOrderModal` era `onClick={onClose}` — no agregaba la OC a ningún lado.

**Archivos modificados:**
- `src/services/mock/suppliers.service.ts` — se agregó `addPurchaseOrder(supplierId, order)`, que agrega la OC al `purchaseOrders` del proveedor en el store en memoria (mismo archivo creado en el bloque de Proveedores de arriba).
- `src/modules/suppliers/components/PurchaseOrderModal.tsx` — "Emitir Orden de Compra" calcula el monto total (subtotal + IVA% + percepciones ya presentes en el formulario) y llama a `addPurchaseOrder`; `toast.success` al confirmar; estado `isSubmitting` para deshabilitar los botones del footer mientras se emite.
- `src/modules/suppliers/SuppliersPage.tsx` — agrega `handleEmitPurchaseOrder`, que actualiza tanto la lista `suppliers` como `selectedSupplier` (si el panel de detalle de ese proveedor está abierto).

**Qué quedó persistiendo de verdad:**
- La OC emitida aparece en la pestaña "Historial y Deuda" de `SupplierDetailPanel` sin recargar (tanto si el panel ya estaba abierto como si se abre después).

**Fuera de alcance / pendiente:**
- No se actualiza `currentBalance` ni `pendingOrdersCount` del proveedor al emitir la OC (no fue pedido; solo que la OC "aparezca" en el historial).
- El botón "Guardar Borrador" sigue sin persistir nada (no fue parte del pedido, solo "Emitir").
- El selector de proveedor del modal sigue limitado a mostrar solo el proveedor ya seleccionado desde `SuppliersPage` (no permite elegir cualquier proveedor de una lista) — comportamiento preexistente, no tocado.

---

## 2026-08-27 — Pedidos (RF-PED-001) — corrección de C4

**Problema:** `CreateOrderModal.handleConfirm` hacía `alert('Pedido guardado con exito!')` y no agregaba nada a `OrdersPage`. Además, `OrderProductsSection` buscaba productos en `INVENTORY_MOCK_DATA.items` (mock estático), no en el store en memoria de `products.service.ts`, por lo que un producto dado de alta con el ABM de Productos (RF-PRD-001) no aparecía al armar un pedido nuevo.

**Archivos modificados:**
- `src/modules/orders/components/create-order/CreateOrderModal.tsx` — carga la lista de productos vigente con `fetchProducts()` (`services/mock/products.service.ts`) y la pasa como prop a `OrderProductsSection`; `handleConfirm` arma un `Order` completo (cliente, dirección/localidad, vendedor, forma de pago, items, subtotal/descuento/IVA/total, estado inicial `'pending'`, origen `'manual'`, un evento de historial inicial) y lo entrega vía la nueva prop `onConfirm`; reemplaza el `alert()` por `toast.success` de sonner.
- `src/modules/orders/OrdersPage.tsx` — agrega `handleCreateOrder`, que antepone el pedido nuevo al array `orders` (el mismo que usan `OrderDetailPanel`/`OrderFilters`), y lo pasa como `onConfirm` al modal.
- `src/modules/orders/components/create-order/OrderProductsSection.tsx` — recibe `products: InventoryItem[]` como prop en vez de importar `INVENTORY_MOCK_DATA` directo; se limpió el hack `@ts-ignore`/`(p as any).barcode` ya que `InventoryItem` tiene `barcode` real; `alert('Producto no encontrado')` reemplazado por `toast.error` de sonner.

**Qué quedó persistiendo de verdad:**
- El pedido confirmado aparece en la tabla de `OrdersPage` sin recargar, con estado "Pendiente", y es completamente navegable en `OrderDetailPanel` (incluye historial y permite avanzar de estado/cancelar como cualquier otro pedido).
- Un producto creado vía RF-PRD-001 ya aparece en el buscador de productos al armar un pedido nuevo.

**Fuera de alcance / pendiente:**
- El botón "Guardar Borrador" del modal sigue sin persistir nada (no fue pedido).
- No se valida stock insuficiente para bloquear la confirmación (la UI ya marca la fila en rojo, pero eso es comportamiento preexistente, no se tocó).
- Ver `CONTRADICCIONES.md` C9: el selector de forma de pago ofrece 2 valores ("Contado", "Cheque") que no pertenecen al tipo `Order['paymentMethod']`; se casteó para poder compilar, sin corregir el desalineamiento de fondo.
