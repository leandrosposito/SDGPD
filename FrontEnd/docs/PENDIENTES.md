# Pendientes

Inventario de deuda técnica e ítems abiertos detectados hasta la fecha. Cada ítem
fue confirmado contra el código real (no es una lista especulativa) — donde la
verificación mostró que el problema no existe o ya no aplica, queda marcado como
tal en vez de listado como pendiente.

---

## Vigentes

### 1. Edición de proveedor: falta el disparador, no la lógica — Severidad: Media

No existe ningún botón "Editar" en la UI de `suppliers` — ni en `SuppliersTable.tsx`
ni en `SupplierDetailPanel.tsx` (que hoy solo expone "Nueva OC" en sus acciones de
header). Confirmado con `grep` de "Editar/onEdit/handleEdit" en todo el módulo: el
único match es el título condicional del modal.

La lógica de edición, sin embargo, **ya está completa** en
`SupplierFormModal.tsx`: precarga los campos desde la prop `supplier` (líneas
26-37), cambia el título a "Editar Proveedor" cuando `supplier` no es null (línea
64), y llama a `onSave(input, supplier?.id)` (línea 51) — `SuppliersPage.tsx`
(`handleSaveSupplier`) ya soporta el update. Falta únicamente un botón que abra el
modal con un `supplier` no-nulo. Funcionalidad que nunca existió — no es una
regresión de la migración a la capa `api/` (Tanda 1), ya documentado así en
`VERIFICACION_TANDA_0_1.md`, punto 11.

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

**Corrección de conteo:** son **4** archivos, no 45 — verificado con
`git ls-files Documentacion/ | grep -E '\.(docx|pdf)$'`:
- `Documentacion/01. Product Vision SDGPD.docx` / `.pdf`
- `Documentacion/Product Vision SDGPD.docx` / `.pdf`

Causa confirmada: los 4 archivos se agregaron en el commit `4d1e8a2` (25/08/2026);
la regla `Documentacion/**/*.docx` / `**/*.pdf` en `.gitignore` (líneas 6-7) recién
se agregó en `b014ff2` (28/08/2026), 3 días después. `.gitignore` no desengancha
retroactivamente archivos ya trackeados — haría falta un `git rm --cached`
explícito, que nunca se hizo. No es urgente (son 4 archivos, no un problema de
tamaño de repo), pero conviene resolver la inconsistencia entre "estos archivos
están en `.gitignore`" y "estos archivos están commiteados" en algún momento.

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
checklists. El punto 4 de `docs/VERIFICACION_TANDA_3A.md` (Pedidos) y el punto 4 de
`docs/VERIFICACION_TANDA_3B.md` (Caja) — exactamente este comportamiento en cada
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

### 12. `InventoryMovement`/`ProductHistoryEvent` sin `branchId` — pendiente para Tanda 3g — Severidad: Baja (bloquea el scope, no la función)

Detectado en `RELEVAMIENTO_INVENTORY.md` (sección C) y confirmado como decisión
cerrada para cuando se migren estas dos tabs (Tanda 3g, ver `DECISIONES_TECNICAS.md`
y `GUIA_MIGRACION_MODULO.md`): un movimiento de stock ocurre físicamente en un
depósito, y el historial es la traza de esos movimientos — ambos tipos
(`shared/types/inventory.types.ts`) necesitan sumar `branchId: Branch['id']` antes
de escribir el DTO de esa tanda. No se tocó en Tanda 3e (fuera de su alcance
cerrado: solo capa `api/` de productos + Stock Actual).

### 13. `updateProduct` descarta los lotes del producto al editar — Severidad: Baja/Media (bug preexistente, preservado sin cambios en Tanda 3e)

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

---

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
| 1 | Edición de proveedor sin botón disparador | Vigente | Media |
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
| 12 | `InventoryMovement`/`ProductHistoryEvent` sin `branchId` | Vigente — pendiente para Tanda 3g | Baja |
| 13 | `updateProduct` (productos) descarta los lotes existentes al editar | Vigente — preexistente, preservado en Tanda 3e | Baja/Media |
| 14 | Productos sin registro de stock en ninguna sucursal (`inv-019`) — decisión de producto pendiente, no bug | Vigente — comportamiento E5 correcto, sin cambios | N/A |
| — | `NewTransactionModal` formato de hora | No reproduce | — |
| — | `OrderProductsSection` `await` faltante | No reproduce (resuelto o nunca existió así) | — |
