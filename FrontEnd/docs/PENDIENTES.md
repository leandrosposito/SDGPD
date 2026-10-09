# Pendientes

Inventario de deuda técnica e ítems abiertos detectados hasta la fecha. Cada ítem
fue confirmado contra el código real (no es una lista especulativa) — donde la
verificación mostró que el problema no existe o ya no aplica, queda marcado como
tal en vez de listado como pendiente.

---

## Vigentes

### 1. Edición de proveedor: falta el disparador, no la lógica — CERRADO (Tanda 12, 2026-09-10)

Resuelto: botón "Editar" agregado al header de `SupplierDetailPanel.tsx` (junto a
"Nueva OC"), llama a `setIsFormModalOpen(true)` con `selectedSupplier` ya en
contexto — reusa `SupplierFormModal.tsx` tal cual estaba (esa lógica ya estaba
completa, ver `VERIFICACION_TANDA_0_1.md` punto 11). Ver
`docs/historial/verificaciones/VERIFICACION_TANDA_12.md`.

### 2. Filtros de zona/vendedor/estado en `ClientAccountsTable` — no aplica, decisión de alcance ya documentada

Verificado: esos filtros **nunca existieron** en `ClientAccountsTable` (git log del
archivo solo tiene 4 commits, todos posteriores a su migración a `usePagedQuery`).
El propio código lo deja explícito en un comentario
(`ClientAccountsTable.tsx:24-27`): el filtro de zona/vendedor/estado del header
superior aplica solo al Directorio de Clientes, fuera de alcance de la tarea que
paginó Cuentas Corrientes — no se agregaron al contrato paginado a propósito. No
es deuda oculta ni algo que se haya perdido en un commit; se deja registrado acá
solo para que quede visible como una posible mejora futura si se decide unificar
el filtro entre ambas vistas.

### 3. `modules/compras` sigue en español — Severidad: Baja (consistencia, cosmético)

Confirmado: la carpeta sigue siendo `modules/compras` (`ComprasPage.tsx`,
`purchaseOrderLabels.ts`, etc.), no renombrada a `purchases` ni ningún equivalente
en inglés. El resto de los módulos de negocio usan nombres en inglés
(`suppliers`, `orders`, `inventory`, `logistics`, `cash`, `clients`). No rompe
nada — es una inconsistencia de nomenclatura, no un bug.

### 4. Archivos `.docx`/`.pdf` trackeados en `Documentacion/` pese al `.gitignore` — Severidad: Baja

**Corrección de conteo (2026-09-09):** son **43** archivos, no 4 (la corrección
anterior de este ítem estaba mal — nunca se reverificó contra el filesystem real
tras la reorganización de `Documentacion/`) — verificado con
`git -c core.quotepath=off ls-files Documentacion/ | grep -E '\.(docx|pdf)$' | wc -l`
el mismo día que esta corrección. Están repartidos en `Documentacion/negocio/`
(la serie de capítulos "02 a".."02 s"/L/ñ + Product Vision 01 + Modelo Funcional,
41 archivos), `Documentacion/_archivo/` (el "Documento 02" viejo, 2 archivos) y
1 archivo suelto en la raíz (`03— Modelo Funcional del Dominio (1).docx`,
pendiente de una decisión manual — ver el informe de la sesión de reorganización).
`Documentacion/Product Vision SDGPD.docx`/`.pdf` (sin prefijo "01.", los que
este ítem citaba antes) ya no existen: se borraron en esa misma reorganización
por ser la versión vieja del Product Vision.

Causa de fondo (sigue vigente, no cambió): estos archivos se agregaron al repo
antes de que existiera la regla `Documentacion/**/*.docx` / `**/*.pdf` en
`.gitignore` (agregada en `b014ff2`, 28/08/2026). `.gitignore` no desengancha
retroactivamente archivos ya trackeados — haría falta un `git rm --cached`
explícito, que nunca se hizo. No es urgente (no es un problema de tamaño de
repo grave), pero conviene resolver la inconsistencia entre "están en
`.gitignore`" y "están commiteados" en algún momento.

### 5. Verificación funcional pendiente de Tandas 0 y 1 — Severidad: Media-Alta

Según la tabla de resultados de `VERIFICACION_TANDA_0_1.md` (líneas 171-185),
verificación del 04/09/2026:
- **No ejecutado:** puntos 1-5 (Tanda 0 completa: fallback del `ErrorBoundary`,
  resto de la app viva, "Reintentar", limpieza al navegar, `logError` en
  consola — no se provocó ningún error de render en la sesión).
- **No ejecutado:** puntos 7, 8, 9, 10 (Tanda 1: `LoadingState` con latencia
  alta, `ErrorState` + reintento con fallo forzado, los 2 reintentos con backoff
  visibles en consola, deep-link Proveedores→Compras).
- **No ejecutado:** puntos 12, 13 (cancelación de requests al tipear rápido,
  cambio de sucursal sin afectar el listado).
- **Verificado (parcial):** puntos 6 y 11 (carga/paginación/orden del listado de
  Proveedores, y alta de proveedor) — ver detalle en ese mismo documento.

Es la deuda de mayor severidad de esta lista: el `ErrorBoundary` extendido y toda
la política de timeout/reintentos/cancelación de `httpClient` están en producción
(commiteados y pusheados) sin haberse ejercitado en el navegador todavía. Los
escenarios siguen disponibles tal cual están documentados, con las variables de
`.env.local.ejemplo-verificacion` — no requieren ningún cambio de código adicional
para retomarse.

### 6. `useSessionStore` mezcla estado de servidor con estado de UI — Severidad: Baja

`session` (viene de `fetchSession()`, dato de servidor) y `activeBranchId` (elección
del usuario, estado de UI) conviven en el mismo store (`useSessionStore.ts:40-47`).
Detectado en `RELEVAMIENTO_CACHE.md` (sección E3) al relevar candidatos a migrar a
TanStack Query — decisión explícita en Tanda 2.5: separarlos queda fuera de esa
tarea. No es urgente (`session` es un singleton idempotente, cargado una sola vez,
no repite fetch como los catálogos que sí se cachearon) pero vale la pena resolverlo
en algún momento para que `shared/state/` no mezcle las dos categorías de estado que
el resto del proyecto sí distingue con cuidado (TanStack Query para servidor,
Zustand para UI).

### 7. Catálogo de Productos y lista de Proveedores sin paginar — Severidad: Baja (hoy), potencialmente Media a escala — PARCIALMENTE RESUELTO (Tanda 3e, 04/09/2026)

`fetchProducts()` y `fetchSuppliers()` (la versión sin paginar, usada para
catálogos/dropdowns — no confundir con `fetchSuppliersPage`, que sí pagina) siguen
trayendo la lista completa: 19 productos, 3 proveedores hoy. Esto es intencional y
**no forma parte de este ítem**: un dropdown de selección (`ProductFormModal`,
`TabPurchases`) no necesita paginación, necesita el catálogo entero para poder
buscar/filtrar en el propio `<select>` — mismo criterio que `suppliers-list`.

Lo que SÍ estaba pendiente y se resolvió en Tanda 3e: la vista de "Stock Actual"
(`TabStockCurrent`, el join catálogo×stock que antes traía TODO sin paginar vía
`getStockedProductsForBranch`) ahora pagina server-side de verdad
(`getStockedProductsPage`, `shared/api/products/products.service.ts`), con
`StockAggregates` para los KPIs — ver `DECISIONES_TECNICAS.md`, entrada de Tanda 3e.
Sigue pendiente, si algún día importa a escala, paginar también el catálogo crudo
usado por los dropdowns — pero no es el mismo problema que el que originó este ítem
(ese era "una tabla completa sin paginar", ya resuelto).

### 8. Pedidos y Caja sin capa de servicio — Severidad: Media — CERRADO A NIVEL DE CÓDIGO (04/09/2026), sin verificación funcional confirmada

`OrdersPage.tsx` y `CashPage.tsx` inicializaban su estado directo desde el mock
importado (`useState<Order[]>(ORDERS_MOCK_DATA)` / `useState(CASH_MOCK_DATA)`), sin
ningún service de por medio — cualquier alta/edición se perdía apenas el componente
se desmontaba (navegar a otra pantalla y volver).

**Los dos migraron a la capa `api/` completa, con store en memoria en el service
(mismo patrón que `products.service.ts`):**
- **Pedidos (`orders`)** — Tanda 3a (04/09/2026), `modules/orders/api/{dto,mapper,orders.service}.ts`.
- **Caja (`cash`)** — Tanda 3b (04/09/2026), `modules/cash/api/{dto,mapper,cash.service}.ts`.

Por diseño, las mutaciones de ambos módulos (crear, cambiar estado/movimiento) ya
deberían sobrevivir a navegar afuera y volver — **pero esto no se probó en el
navegador para ninguno de los dos**: los commits de las dos tandas se autorizaron en
base a `tsc -b`/`lint`/`build` limpios y análisis de código, no en base a estos
checklists. El punto 4 de `docs/historial/verificaciones/VERIFICACION_TANDA_3A.md` (Pedidos) y el punto 4 de
`docs/historial/verificaciones/VERIFICACION_TANDA_3B.md` (Caja) — exactamente este comportamiento en cada
módulo — siguen "No ejecutado". Hasta que se confirmen, este ítem se considera
**resuelto por código, no verificado en los hechos** — se deja este matiz explícito
en vez de marcarlo simplemente "cerrado".

### 9. `ProductLot` embebido en el catálogo (empresa), no por sucursal — Severidad: Baja (deuda de modelado)

Detectado en `RELEVAMIENTO_INVENTORY.md` (sección B4/C) al migrar `inventory` a la
capa `api/` (Tanda 3e): `InventoryItem.lots?: ProductLot[]` vive en el catálogo
(scope EMPRESA, `inventory.types.ts:56`), pero conceptualmente un lote es
físicamente stock en un depósito concreto — inconsistente con el criterio ya
cerrado "catálogo=empresa, stock=sucursal" (E1, Tanda 2.5) que sí aplica
correctamente a `ProductStock`/`PurchaseSuggestion`. Hoy el mock (`inventory.data.ts`)
da lotes fijos por producto, iguales sin importar la sucursal activa desde la que
se los mire.

**No es bloqueante para nada:** `ProductLotsPanel.tsx` funciona igual sin importar
esto (recibe el objeto completo por click, no depende de paginación — confirmado en
Tanda 3e), y no se tocó en esa tanda. Queda como decisión de modelado pendiente
para si en algún momento se necesita que los lotes reflejen sucursales distintas
(ej. el mismo producto con lotes distintos en dos depósitos).

### 10. 4 tabs de `inventory` son UI construida sin funcionalidad — features futuras, no código muerto — Severidad: N/A (registro, no bug)

Confirmado por `grep` de `onClick` (cero matches en los 4 archivos) durante el
relevamiento de Tanda 3e (`RELEVAMIENTO_INVENTORY.md`, A1/A2):

- **Ajustes de Stock** (`TabAdjustments.tsx`) — formulario completo (producto,
  cantidad, motivo, lote, vencimiento, notas) que no envía nada: `onSubmit` solo
  hace `preventDefault()`, el buscador de producto solo tiene un `console.log`.
- **Categorías** (`TabCategories.tsx`) — tabla con datos hardcodeados
  (`CATEGORIES_MOCK`, no sale de ningún mock real), "Nueva Categoría"/"Editar" sin
  ningún handler.
- **Listas de Precios** (`TabPriceLists.tsx`) — tabla con datos hardcodeados
  (`PRICE_LIST_MOCK`), inputs de margen no controlados (`defaultValue`, sin
  `onChange`), "Guardar Cambios" sin handler.
- **Importar / Exportar** (`TabImportExport.tsx`) — dropzone y 2 botones de
  exportar, ninguno con acción real.

Se dejan explícitamente señaladas como **features futuras con la UI ya construida**,
no como código muerto a eliminar — decisión tomada al planificar Tanda 3e/3f/3g:
nadie debería borrarlas asumiendo que son descarte. Si en algún momento se decide
implementarlas de verdad, cada una necesita su propio tipo de dominio real (hoy
`CategoryMock`/`PriceListMock` son interfaces locales al componente, no tipos de
`shared/types/inventory.types.ts`) y su propio service — no hay ningún dato real
detrás hoy que un `api/` pudiera envolver.

### 11. `StockAdjustmentModal.tsx` — código huérfano, no montado en ningún lado — Severidad: Baja

Confirmado (ya documentado en el propio archivo, `StockAdjustmentModal.tsx:10-15`,
y reconfirmado en `RELEVAMIENTO_INVENTORY.md` durante Tanda 3e): ningún componente
de `inventory` lo importa ni lo renderiza — `InventoryPage.tsx` no lo monta, ninguna
tab lo abre. Sí se actualizó su import de `products.service` y su firma
(`getStockForBranch` ahora pide `empresaId`) en Tanda 3e para que siga
compilando (`tsc -b` lo exige aunque esté huérfano), pero no se lo conectó a nada —
seguir sin punto de montaje es una decisión de esta tanda, no un olvido. Si en algún
momento se decide implementar un flujo real de ajuste de stock manual, este archivo
es el punto de partida más cercano a algo funcional (ya resuelve el stock actual del
producto vía `getStockForBranch`).

### 12. `InventoryMovement`/`ProductHistoryEvent` sin `branchId` — CERRADO A NIVEL DE CÓDIGO (Tanda 3g, 06/09/2026), sin verificación funcional confirmada

Detectado en `RELEVAMIENTO_INVENTORY.md` (sección C), no se tocó en Tanda 3e (fuera
de su alcance cerrado) y se resolvió en Tanda 3g: `branchId: Branch['id']` agregado
a ambos tipos (`shared/types/inventory.types.ts`), poblado en el mock repartido
entre las 3 sucursales activas (no todos en `branch-001` — ver
`DECISIONES_TECNICAS.md`, entrada de Tanda 3g, punto 2). `TabMovements.tsx` y
`TabProductHistory.tsx` migradas a `usePagedQuery` contra
`modules/inventory/api/movements/` y `modules/inventory/api/product-history/`,
filtrando por la sucursal activa. Verificado por script contra los datos reales del
mock que el filtro devuelve conjuntos disjuntos por sucursal (ver
`DECISIONES_TECNICAS.md` punto 8) — **no verificado todavía en el navegador**, ver
`docs/historial/verificaciones/VERIFICACION_TANDA_3G.md`. Mismo matiz que el ítem 8 de esta tabla: resuelto
por código, no confirmado en los hechos.

### 13. `updateProduct` descarta los lotes del producto al editar — CERRADO A NIVEL DE CÓDIGO (sesión avance-2026-09-30), sin verificación funcional confirmada — Severidad original: Baja/Media (bug preexistente, preservado sin cambios en Tanda 3e)

**Resuelto (2026-09-30):** `updateProduct` ahora arma el registro con
`mergeProductUpdate` (`shared/api/products/productUpdate.ts`), que conserva los
`lotes` del registro anterior salvo que el input traiga `lots` explícito. Smoke
`scripts/smoke/avance-2026-09-30-lotes.smoke.mjs` (14/14, sobre `inv-001` real).
Checklist de navegador: `docs/historial/verificaciones/VERIFICACION_2026-09-30_T2_lotes.md`.
Mismo matiz que los ítems 8 y 12: resuelto por código, no confirmado en los hechos.
Texto original del hallazgo, abajo:

Hallazgo de Tanda 3e al migrar `updateProduct` a la capa `api/`: el formulario de
edición de producto (`ProductFormModal`/`ProductFormValues`) nunca incluyó `lots` —
tanto en el service viejo (`services/mock/products.service.ts`, antes de esta
tanda) como en el nuevo (`shared/api/products/products.service.ts`), guardar una
edición reemplaza el registro completo con los campos del formulario más `id`, sin
copiar los lotes existentes del producto. Efecto visible: **editar cualquier
producto que tenga lotes cargados los deja vacíos** (`ProductLotsPanel` mostraría
"sin lotes registrados" después). Es un comportamiento preexistente a Tanda 3e, no
introducido por ella — se preservó tal cual (D4, no se reabre lógica de negocio no
pedida), documentado acá para que no se pierda como hallazgo real. Fix sugerido para
cuando se decida corregirlo: `updateProduct` debería conservar `lotes` del registro
anterior (`productsDTOStore.find(...)`) en vez de descartarlo, salvo que el
formulario los edite explícitamente en el futuro.

### 14. Productos del catálogo sin ningún registro de stock en ninguna sucursal — Severidad: N/A (decisión de producto pendiente, no un bug)

Detectado al verificar Tanda 3e en el navegador: `inv-019` ("Producto
Descontinuado 500g", `inventory.data.ts:67`) es un producto activo del catálogo
que no tiene registro en `productStock.data.ts` en NINGUNA de las 3 sucursales
(a diferencia de `inv-018`, que solo falta en `branch-003` — caso de borde ya
documentado a propósito en el mock). Hoy este producto:

- Aparece en **Stock Actual** en las 3 sucursales, como "Sin Stock" (join E5,
  `stock: 0, stock_minimo: 0`).
- **Nunca aparece en "Bajo Stock Mínimo"**, en ninguna sucursal — `getLowStockPage`
  itera solo `stockDTOStore` (registros reales), nunca sintetiza uno (E5: sin
  registro = sin mínimo definido, no puede estar "bajo mínimo").
- **No cuenta para el KPI "Stock Bajo"** de Stock Actual, por el mismo motivo
  (`computeStockAggregates` excluye explícitamente los productos sin registro,
  ver `DECISIONES_TECNICAS.md` punto 5).

**Esto es correcto y consistente con la regla E5 ya cerrada, no un bug** — se
verificó explícitamente que no rompe el invariante "Stock Bajo" = "Bajo Stock
Mínimo" (`DECISIONES_TECNICAS.md`, punto 12). Lo que queda pendiente es una
**decisión de producto**, no una corrección: ¿un producto del catálogo que nunca
se cargó en ninguna sucursal debería aparecer marcado en algún lado como "falta
cargar stock/mínimo acá", en vez de ser indistinguible de "está en 0 porque se
vendió todo"? Hoy las dos situaciones se ven igual (ambas caen en "Sin Stock").

**Por qué no se cambió en esta tanda:** implicaría uno de estos costos, ninguno
menor:
- Cambiar `getLowStockPage` para hacer left-join contra el catálogo completo
  (como `getStockedProductsPage`), no iterar solo `stockDTOStore` — un cambio de
  fondo en qué significa "Bajo Stock Mínimo".
- Definir qué mostrar como "mínimo" para un producto sin mínimo real, y un
  estado visual nuevo que no confunda "sin cargar" con "bajo mínimo real"
  (`TabLowStock.tsx`, badges/colores).
- Actualizar `exportLowStock` (comparte la función) para el mismo criterio.
- Podría ser una lista más larga de lo que parece a escala (cualquier producto
  nuevo dado de alta en el catálogo pero no en todas las sucursales todavía
  caería acá) — necesita pensarse como feature, no como fix puntual.

Queda registrado para cuando se decida si hace falta distinguir "sin stock
cargado" de "agotado" en la UI.

### 15. `CreateClientModal` tenía 10 campos "fantasma" además de los 2 que se conectaron en Tanda 12 — CERRADO (Tanda 16, 2026-09-11)

**Corrección de conteo:** este ítem decía "9 campos" pero la lista de abajo
siempre tuvo 10 nombres — confirmado contra el código (19 `useState` totales en
`CreateClientModal.tsx:27-48` − 9 conectados = 10, no 9).

Resuelto: los 10 campos se conectaron de punta a punta (mismo criterio que
`priceList`/`saleCondition` en Tanda 12 — ya tenían UI real y funcional, así que
se conectan en vez de quitarse del formulario): tipo (`ClientAccount`, todos
requeridos), DTO/mapper, backfill de los 30 clientes semilla, `buildClientInput()`
y el precargado de edición. Ver
`docs/historial/verificaciones/VERIFICACION_TANDA_16.md`.

- `ClientGeneralTab`: `nombreFantasia` → `tradeName`, `condicionIva` → `ivaCondition`, `email`.
- `ClientLogisticsTab`: `googleMapsLink`, `isEntregaIgualFiscal` → `deliveryAddressSameAsFiscal`, `direccionEntrega` → `deliveryAddress`,
  `referenciasEntrega` → `deliveryReferences`.
- `ClientSettingsTab`: `categoria` → `businessCategory`, `notas` → `notes`, `isActive`.

**Queda fuera de alcance, sin tocar:** ningún listado (`ClientDirectoryTable`/
`ClientAccountsTable`) muestra todavía un indicador de `isActive` — se conectó el
campo (se guarda y se relee), no se agregó UI nueva sobre el listado, porque no
fue lo pedido.

---

### 16. `deliveryAddressSameAsFiscal`/`deliveryAddress`/`deliveryReferences` (Tanda 16) sin consumidor — Severidad: Media

Verificado el 2026-10-07 (`grep -rn "deliveryAddressSameAsFiscal\|deliveryAddress" src`): son el otro booleano (y sus 2 campos asociados) que la Tanda 16 conectó al formulario de clientes. Se guardan y se releen, pero nada fuera de `create-client/`, el DTO y el mapper los lee. `CreateOrderModal.tsx#handleConfirm` arma el pedido con `clientAddress: selectedClient.address` (la dirección **fiscal**), así que un cliente con dirección de entrega distinta recibe el pedido en la fiscal. Mismo patrón de migración a medias que `isActive` (cerrado en la Tanda 17), pero **no se corrigió**: decidir qué dirección toma el pedido (la de entrega del cliente, la fiscal o la que se cargue en `OrderDeliverySection`, ver ítem 17) es una decisión de producto, no una conexión mecánica. Ver `docs/historial/auditorias/AUDIT_2026-10-07_clientes-inactivos.md` MEDIO-4.

### 17. `OrderDeliverySection` captura dirección/localidad/contacto/teléfono y el alta de pedido los descarta — Severidad: Media

Verificado el 2026-10-07: `CreateOrderModal.tsx` tiene `useState` para `address`, `locality`, `contact` y `phone` y se los pasa a `OrderDeliverySection`, pero `OrderFormInput` no tiene esos campos y `handleConfirm` no los incluye. Son campos fantasma, la misma clase de hueco que el ítem 15 cerró en clientes. Está atado al ítem 16 (cuál es la dirección de entrega de un pedido) y conviene resolverlos juntos. Preexistente, no lo introdujo ninguna tanda reciente.

### 18. `fetchProducts` (catálogo completo, sin límite) llamado desde adentro de 4 operaciones del servidor — Severidad: Media (a escala). Hoy no tiene impacto

Introducido en la Tanda 14. `getPurchaseSuggestionsPage`, `exportPurchaseSuggestions`, `createOrder` y `purchaseOrders.service.ts#hasInactiveProduct` (que usan `createPurchaseOrder`/`generatePurchaseOrderFromSuggestion`) llaman a `fetchProducts`, que trae el catálogo entero por `httpClient`, para saber qué productos están activos. Contradice las reglas 3.1 y 3.11. **Decisión y forma del contrato objetivo: `docs/adr/ADR-016-filtro-estado-server-side.md`.** No se reescribió el mock (no fue pedido y con 19 productos no cambia nada observable). La condición es que el código nuevo no repita el patrón y que, cuando se toque cualquiera de esas funciones por otro motivo, se reemplace por un lookup acotado (`getProductStatusByIds`). ADR-016 también actualiza la postura del ítem 7 sobre los dropdowns con catálogo completo: aceptable en el mock, no con backend real.

### 19. 5 líneas de pedido del seed apuntan a SKUs que no existen en el catálogo, y `createOrder` acepta SKUs desconocidos — CERRADO (Tandas 20 y 21, 2026-10-07)

**Cierre:** Tanda 20 corrigió el dato (`YER-TAR-1K` → `YER-MAT-1K`, `GAL-SUR-200` → `GAL-AGU-200`, solo `sku`/`name`, totales intactos). V17 D2.3 pasó a verde **sin modificar el check**. Tanda 21 agregó `reason: 'product-not-found'` a `createOrder` (enmienda de ADR-015), con 3 checks nuevos en V17 que fallan contra el código previo. Ver `VERIFICACION_TANDA_20.md`/`VERIFICACION_TANDA_21.md`. Los mismos SKUs huérfanos en otros mocks quedan en el ítem 20.

**Texto original:**

Encontrado en la Fase D de la sesión 2026-10-07 (`scripts/verificacion/v17-clientes-inactivos.mjs`, D2.3, que **falla a propósito y queda así** hasta que se corrija el dato, regla 2.5): `ord-001/YER-TAR-1K`, `ord-001/GAL-SUR-200`, `ord-003/GAL-SUR-200`, `ord-004/GAL-SUR-200` y `ord-006/YER-TAR-1K`. `inventory.data.ts` no tiene ni `YER-TAR-1K` ni `GAL-SUR-200` (tiene `YER-MAT-1K`, `YER-UNI-05` y `GAL-AGU-200`). Es preexistente: ninguna verificación anterior cruzaba `OrderItem.sku` contra el catálogo. Relacionado: el chequeo de la Tanda 14 en `createOrder` (`products.find(sku)?.status === 'inactive'`) deja pasar en silencio un sku que no existe. Un backend real debería rechazarlo con su propio `reason` (`'product-not-found'`). No se tocó: es MEDIO/BAJO y está fuera del alcance pedido.

### 20. Los mismos SKUs/nombres huérfanos en analytics, proveedores y alertas — Severidad: Media (analytics, alertas) / Baja (proveedores)

Encontrado en la Fase A de la sesión 2026-10-07b (`AUDIT_2026-10-07b_seed-skus.md`), fuera del alcance pedido (el ítem 19 nombraba solo `orders.data.ts`):
- `analytics.data.ts:25-26,54-55,84-85,121-122`: los rankings de productos usan `YER-TAR-1K`/`GAL-SUR-200`. Es un dataset estático sin service (ALTO abierto en `ESTADO.md`), así que corregirlo tiene sentido recién cuando `analytics` derive del catálogo real.
- `alerts.data.ts:21,23`: `alr-005` (`productId: 'inv-013'`, Papel Higiénico) dice `productName: 'Yerba Taragui 1kg'`, y `alr-003` (`inv-009`, Arroz) dice "Galletitas Surtidas 200g". El id resuelve, pero el nombre denormalizado miente.
- `suppliers.data.ts:44,64`: el catálogo **del proveedor** lista esos SKUs. Puede ser legítimo (productos que el proveedor vende y nosotros no tenemos dados de alta). No hay regla que lo decida.

### 21. `sumMoney`, `multiplyMoney` y `parseMoneyInput` sin consumidor de producción, y 3 multiplicaciones de dinero en float — Severidad: Media (ADR-008)

Registrado el 2026-10-09 (Tanda 22), como excepción del Gate 5 (`PROTOCOLO.md` §5: un export sin call-site real es código muerto salvo que figure acá con el ADR y el disparador).

- `shared/utils/money.ts`: `sumMoney`, `multiplyMoney` y `parseMoneyInput` no tienen consumidor de producción. Solo los ejercita `scripts/smoke/tanda-7.smoke.mjs`. Son la API del módulo único de dinero (ADR-008).
- Multiplicaciones de dinero en `number` flotante que no pasan por el módulo (el patrón del hallazgo #3 de AUDIT_10):
  - `modules/compras/components/PurchaseOrderDetailPanel.tsx:144` — `r.quantity * r.unitPrice`
  - `modules/orders/components/create-order/CreateOrderModal.tsx:113` — `item.price * item.quantity`
  - `services/mock/purchaseOrders.service.ts:61` — `l.quantity * l.unitPrice`
- **Disparador:** la conexión de cada módulo al backend (ADR-BE-006 §49-51). Cada módulo pasa sus importes a `Money`, y los totales vienen del servidor o de la función de `packages/contracts`.
- **Decisión:** no se migran antes.

### 22. Respuestas de `httpClient.request<T>` de viajes, entregas, vehículos y choferes tipan ids branded sin validarlos — Severidad: Media (hoy en mock), Alta al conectar

Registrado el 2026-10-09 (Tanda 23; punto ciego G1 de la Tanda 22). Estos 4 services no tienen DTO ni mapper: el genérico de `httpClient.request<T>` declara el tipo de dominio (con `TripId`, `DeliveryId`, `VehicleId`, etc.) sobre un JSON que en modo `http` nadie valida. `clients`/`orders` sí construyen los ids con `as<Tipo>Id(dto.id)` en su mapper.

- `modules/logistics/services/trips.service.ts`: 134, 176, 226, 322, 430, 470, 529, 639, 754, 778.
- `modules/logistics/services/deliveries.service.ts`: 228, 296, 356, 425, 537, 702, 769, 788.
- `shared/api/vehicles/vehicles.service.ts`: 57, 121, 151, 178, 200.
- `shared/api/drivers/drivers.service.ts`: 48, 101, 121, 140, 161.
- Mismo caso, fuera de la lista pedida: `modules/logistics/services/pod.service.ts:63` (`Pod | null`).
- **Disparador:** la conexión de cada módulo al backend, con un DTO y un mapper que construya los ids con `as<Tipo>Id` (ADR-006, ADR-BE-004).
- **Decisión:** no se hace antes.

### 23. `'' as Trip['id']` en `TripDetailPanel.tsx:119` — Severidad: Baja (sin efecto: la consulta está deshabilitada sin viaje)

Registrado el 2026-10-09 (Tanda 23, 23.2 no hecho). Centinela vacío casteado a `TripId` por tipo indexado, que la regla `no-restricted-syntax` de la Tanda 22 no ve. Para modelar "no hay id todavía" como `undefined` habría que cambiar `TripPositionQueryFilters.tripId` (el parámetro de `getTripPosition`), y eso es cambiar la firma de un service. La extensión de la regla al cast por tipo indexado quedó probada (marca exactamente `TripDetailPanel.tsx:119`) y revertida hasta que se decida el fix. Ver `REPORTE_2026-10-09_tandas23-24.md`.

## Reportados pero no reproducidos (verificados y descartados)

Estos dos ítems se investigaron con evidencia de código directa (no solo lectura
rápida) y **no reproducen tal como fueron descritos**. Se dejan documentados acá
en vez de omitirlos, para que quede registro de que se revisaron.

### `NewTransactionModal.tsx` (cash) — formato de hora: NO es un bug

La preocupación era que `toLocaleTimeString('es-AR')` devuelve 12h con AM/PM,
incompatible con el `HH:mm` estricto que exige `<input type="time">`. En el
código actual (`NewTransactionModal.tsx:39`) la llamada es:

```ts
now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
```

El `hour12: false` está pasado explícitamente, así que el resultado ya es 24h
(`HH:mm`) — compatible con el `<input type="time">` de la línea 80. No hay
mismatch en el código tal como está hoy.

### `OrderProductsSection` — escáner de códigos de barras: el `await` ya está

La preocupación era que faltaba `await` en la mutación async del handler del
escáner. En el código actual (`OrderProductsSection.tsx:46-60`), `handleKeyDown`
es `async` y la línea 60 ya tiene:

```ts
const stockRecord = activeBranchId ? await getStockForBranch(match.id, activeBranchId) : undefined;
```

El `await` está presente. Nota aparte, de menor severidad: el handler no tiene
ningún guard de reentrancy (no hay una bandera tipo `isProcessing` que bloquee un
segundo `Enter` mientras el primero todavía está esperando `getStockForBranch`) —
dos escaneos muy rápidos en sucesión podrían seguir pisándose por el cierre
(`closure`) desactualizado de `items`, pero ese es un problema distinto al que se
reportó originalmente ("falta el `await`"), y de severidad baja dado que un
escáner físico normalmente no dispara dos `Enter` en un intervalo tan corto.

---

## Tabla resumen

| # | Ítem | Estado | Severidad |
|---|---|---|---|
| 1 | Edición de proveedor sin botón disparador | **Cerrado** (Tanda 12; reverificado 2026-09-30: `SupplierDetailPanel.tsx:244`) | — |
| 2 | Filtros zona/vendedor/estado en ClientAccountsTable | No aplica (alcance documentado) | — |
| 3 | `modules/compras` en español | Vigente | Baja |
| 4 | 4 .docx/.pdf trackeados pese a `.gitignore` | Vigente | Baja |
| 5 | Verificación funcional Tandas 0/1 (puntos 1-5, 7-10, 12-13) | Vigente | Media-Alta |
| 6 | `useSessionStore` mezcla server state (session) y UI state (activeBranchId) | Vigente | Baja |
| 7 | Catálogo de Productos/Proveedores sin paginar (dropdowns) — la vista de Stock Actual sí pagina desde Tanda 3e | Parcialmente resuelto (Tanda 3e) | Baja (hoy) |
| 8 | Pedidos y Caja sin capa de servicio (mutaciones se pierden al desmontar) | Resuelto por código (Tanda 3a/3b), sin verificar en navegador | Media |
| 9 | `ProductLot` embebido en catálogo (empresa), debería ser por sucursal | Vigente — deuda de modelado, no bloqueante | Baja |
| 10 | 4 tabs de `inventory` (Ajustes, Categorías, Listas de Precios, Import/Export): UI sin funcionalidad | Vigente — features futuras, no código muerto | — |
| 11 | `StockAdjustmentModal.tsx` — huérfano, no montado | Vigente | Baja |
| 12 | `InventoryMovement`/`ProductHistoryEvent` sin `branchId` | Resuelto por código (Tanda 3g), sin verificar en navegador | Baja |
| 13 | `updateProduct` (productos) descarta los lotes existentes al editar | **Cerrado** (sesión avance-2026-09-30, `mergeProductUpdate`), sin verificar en navegador | — |
| 14 | Productos sin registro de stock en ninguna sucursal (`inv-019`) — decisión de producto pendiente, no bug | Vigente — comportamiento E5 correcto, sin cambios | N/A |
| 15 | `CreateClientModal` con 10 campos fantasma (nota: tabla no incluía este ítem hasta ahora, corregido al cerrarlo) | Cerrado (Tanda 16) | — |
| 16 | `deliveryAddressSameAsFiscal`/`deliveryAddress` sin consumidor: el pedido usa la dirección fiscal | Vigente (decisión de producto pendiente) | Media |
| 17 | `OrderDeliverySection`: dirección/localidad/contacto/teléfono fantasma en el alta de pedido | Vigente | Media |
| 18 | `fetchProducts` completo dentro de 4 operaciones server-side (Tanda 14) | Vigente, documentado en ADR-016 | Media (a escala) |
| 19 | 5 líneas de pedido del seed con SKU inexistente; `createOrder` acepta SKUs desconocidos | **Cerrado** (Tandas 20/21; V17 en verde) | — |
| 20 | SKUs/nombres huérfanos en `analytics.data`, `alerts.data`, `suppliers.data` | Vigente | Media / Baja |
| 21 | `sumMoney`/`multiplyMoney`/`parseMoneyInput` sin consumidor de producción + 3 multiplicaciones de dinero en float | Vigente — se conecta con cada módulo (ADR-BE-006 §49-51) | Media |
| 22 | `httpClient.request<T>` de viajes/entregas/vehículos/choferes tipan ids branded sin validar (sin DTO ni mapper) | Vigente — se resuelve al conectar cada módulo | Media / Alta al conectar |
| 23 | `'' as Trip['id']` en `TripDetailPanel.tsx:119` (la regla de ESLint no ve el cast indexado) | Vigente — el fix pide cambiar la firma de `getTripPosition` | Baja |
| — | `NewTransactionModal` formato de hora | No reproduce | — |
| — | `OrderProductsSection` `await` faltante | No reproduce (resuelto o nunca existió así) | — |
