# Registro de Contradicciones Detectadas (SDGPD)

Este documento mantiene el estado vivo de las contradicciones entre la documentación funcional (Doc 04) y el código actual.

### C1 — Límites de módulo del código no coinciden con los módulos del Doc 04
- **Estado:** RESUELTA (mitigada por convención de comentarios, no por refactor).
- **Detalle:** El Doc 04 separa ORG, IAM, CAT, PRD, INV, PRI, CLI, PRO como módulos distintos. El código los fusionó en la UI.
- **Resolución:** No mover archivos ni reestructurar carpetas. Mantener el agrupamiento visual actual, pero cada componente/tipo/mock nuevo debe llevar comentario explícito indicando a qué RF pertenece.

### C2 — Tab "Suscripción" en Configuración no corresponde a ningún RF del Doc 04
- **Estado:** PENDIENTE DE DECISIÓN DEL USUARIO.
- **Detalle:** Es un módulo de facturación SaaS que no está en el backlog de 83 RF.
- **Acción requerida:** No modificar hasta que el usuario decida si dejarlo intacto, ocultarlo o marcarlo fuera de alcance.

### C3 — Tab "Comercial" (Configuración) se solapa con RF-PRI-001 y RF-CLI-002
- **Estado:** ABIERTA.
- **Detalle:** Tiene un mini-ABM informal de "Listas de Precios Activas" y "Límite Global de Crédito".
- **Acción requerida:** No tocar hasta implementar RF-PRI-001 y RF-CLI-002. Revisar fuente de verdad en ese momento.

### C4 — Los formularios "Guardar" no persisten nada (patrón repetido)
- **Estado:** RESUELTA (para RF-PRD-001, RF-CLI-001, RF-PRO-001, RF-CMP-001 y RF-PED-001, unico alcance cubierto hasta ahora).
- **Detalle:** Botones "Guardar" solo cerraban el modal sin onSave real. Contradecia RF-CLI-001, RF-PRO-001, RF-CMP-001, RF-PED-001, RF-PRD-001.
- **Resolución:** Corregir este patrón solo dentro del RF que se esté trabajando en ese momento.
- **RF-PRD-001 (implementado):** `ProductFormModal` ahora persiste Alta/Modificación/Baja contra `services/mock/products.service.ts` (mock service con delay simulado, en memoria durante la sesión). El botón "Eliminar" antes solo cerraba el modal; ahora ejecuta una baja real con confirmación inline.
- **RF-CLI-001 (implementado):** `CreateClientModal` ahora persiste Alta/Modificación contra `services/mock/clients.service.ts` (mismo patrón: store en memoria a partir de `CLIENTS_MOCK_DATA`). `ClientsPage` carga el listado con `fetchClients()` y lo refleja en `ClientDirectoryTable`/`ClientAccountsTable` sin recargar. El botón "Guardar y Nuevo Pedido" dejó de usar `alert()` nativo; ahora usa `toast.success` de sonner (el flujo de apertura del pedido sigue simulado, eso no era parte de este alcance). El formulario se mantuvo en `useState` (no se migró a react-hook-form/zod) para no reescribir los 4 sub-tabs, tal como se acordó como aceptable para esta corrección puntual.
- **RF-PRO-001 (implementado):** `SupplierFormModal` pasó de inputs no controlados sin `onChange` (el botón "Guardar Proveedor" literalmente solo cerraba el modal) a un formulario controlado con validación mínima (Razón Social y CUIT obligatorios) que persiste Alta/Modificación contra `services/mock/suppliers.service.ts` (store en memoria a partir de `SUPPLIERS_MOCK_DATA`). `SuppliersPage` carga el listado con `fetchSuppliers()` y lo refleja en `SuppliersTable` sin recargar.
- **RF-CMP-001 (implementado, alcance frontend):** `PurchaseOrderModal` — "Emitir Orden de Compra" antes era `onClick={onClose}` (no hacía nada). Ahora llama a `addPurchaseOrder` (agregado a `suppliers.service.ts`), que agrega la OC al `purchaseOrders` del proveedor correspondiente; `SuppliersPage` propaga el proveedor actualizado tanto a la lista como al panel de detalle abierto, por lo que la OC aparece en la pestaña "Historial y Deuda" de `SupplierDetailPanel` sin recargar. Confirmación vía `toast.success`.
- **RF-PED-001 (implementado):** `CreateOrderModal` — "Confirmar Pedido" antes hacía `alert('Pedido guardado con exito!')` y no persistía nada. Ahora arma un `Order` completo (cliente, items, totales con IVA, entrega, estado inicial `pending`) y lo agrega al array `orders` de `OrdersPage` (el mismo que usan `OrderDetailPanel`/`OrderFilters`), con `toast.success` de sonner. De paso se corrigió `OrderProductsSection`, que buscaba productos en `INVENTORY_MOCK_DATA.items` (mock estático) en vez de en el store en memoria de `products.service.ts` — un producto creado con el ABM de Productos (RF-PRD-001) no aparecía al armar un pedido; ahora recibe la lista vigente como prop (`fetchProducts()` levantado en `CreateOrderModal`). El `alert('Producto no encontrado')` de esa búsqueda también se reemplazó por `toast.error`.

### C5 — InventoryItem mezcla datos maestro de Producto (RF-PRD) con datos de Inventario (RF-INV)
- **Estado:** RESUELTA (mitigada por convención de comentarios, no por refactor — igual que C1).
- **Detalle:** Faltan campos explícitos de RF-PRD-001: código de barras, descripción separada, unidad de medida base, estado real.
- **Resolución (RF-PRD-001):** Los campos ya existían en `InventoryItem` (barcode, description, unitOfMeasure, status). No se separó la interfaz para no romper a los consumidores existentes (Table, filtros de otras pestañas, etc.); en su lugar `shared/types/inventory.types.ts` ahora anota explícitamente qué campos pertenecen a RF-PRD-001, cuáles a RF-INV-001 y cuáles a RF-PRI-001.

### C6 — Mock de categorías hardcodeado dentro del componente
- **Estado:** ABIERTA.
- **Detalle:** `TabCategories.tsx` tiene `CATEGORIES_MOCK` inline.
- **Acción requerida:** Mover a `src/data/mock/` al implementar RF-CAT-001.

### C7 — `npm run build` roto por incompatibilidad de tipos zod v4 + @hookform/resolvers en ProductFormModal
- **Estado:** ABIERTA (detectada al verificar build/lint de la corrección de C4, no introducida por esa corrección).
- **Detalle:** `tsc -b` falla con 3 errores en `src/modules/inventory/components/ProductFormModal.tsx` (líneas 53, 148, 158): el `Resolver` que devuelve `zodResolver(schema)` infiere `cost`/`price`/`stock`/`minStock` como `unknown` en vez de `number`, lo que no es asignable al tipo que espera `useForm<ProductFormValues>`. Es un problema de inferencia genérica entre zod v4 (`4.4.3`) y `@hookform/resolvers` (`5.9.1`), no un error de lógica. Ya estaba presente (archivo con cambios sin commitear) antes de empezar la corrección de C4; `npm run build` no compila hoy por este motivo.
- **Acción requerida:** Revisar en una sesión de RF-PRD-001 si conviene tipar el schema de forma explícita (p.ej. `z.coerce.number()` con un cast intermedio, o ajustar `ProductFormValues`) para que el `Resolver` cierre sin fricción. No se tocó como parte de esta tarea porque `ProductFormModal.tsx` se pidió explícitamente dejar intacto ("es el ejemplo a replicar").

### C8 — Los formularios de Clientes y Proveedores capturan campos que sus tipos no modelan
- **Estado:** ABIERTA.
- **Detalle:** Al resolver C4 para RF-CLI-001 y RF-PRO-001 se persistieron solo los campos que existen en `ClientAccount` / `Supplier` (`shared/types/client.types.ts` y `supplier.types.ts`). Pero las UI de `CreateClientModal` (tabs Logística/Comercial/Ajustes: nombre de fantasía, condición IVA, email, dirección de entrega, lista de precios, categoría, notas, activo/inactivo, etc.) y de `SupplierFormModal` (condición ante el IVA, y todo lo que hoy cubre `SupplierDetailPanel` como contacto/dirección/ciudad/plazo de pago) siguen mostrando esos campos sin que se guarden en ningún lado — se pierden silenciosamente al confirmar. Un proveedor nuevo, por ejemplo, queda con `contactName`/`address`/`city`/`paymentTerms` vacíos porque el formulario no los captura.
- **Acción requerida:** Cuando se trabajen RF-CLI-001 y RF-PRO-001 completos (no solo la persistencia mínima de C4), decidir si se amplían `ClientAccount`/`Supplier` con esos campos o si se documenta que son datos futuros (RF-CLI-002/RF-PRO-002 u otro).

### C9 — El selector "Forma de Pago" de Pedidos ofrece valores fuera del tipo `Order.paymentMethod`
- **Estado:** ABIERTA (detectada al resolver C4 para RF-PED-001, no introducida por esa corrección).
- **Detalle:** `OrderClientSection.tsx` ofrece las opciones "Cuenta Corriente", "Contado", "Efectivo", "Transferencia" y "Cheque", pero `Order['paymentMethod']` (`shared/types/order.types.ts`) solo admite `'Cuenta Corriente' | 'Efectivo' | 'Transferencia'`. Si un usuario elige "Contado" o "Cheque" al crear un pedido, ese valor no pertenece al union type. Al conectar `CreateOrderModal` a `OrdersPage` (C4/RF-PED-001) se tuvo que castear (`paymentMethod as Order['paymentMethod']`) para poder compilar, sin corregir el desalineamiento de fondo.
- **Acción requerida:** Al trabajar RF-PED-001 completo, decidir si el tipo se amplía a las 5 opciones o si se recorta el `<select>` a las 3 que el tipo soporta hoy.
