# Verificación funcional manual — Tanda 2.5 (httpClient unificado + useCachedQuery)

**Quién ejecuta esto:** vos, en el navegador. No requiere leer código — cada punto dice
exactamente qué configurar, qué hacer y qué mirar.

**Qué cubre:** unificación de `products`/`clients`/`dashboard`/`purchaseOrders`/
`deliveries` bajo `httpClient` (antes solo `suppliers` pasaba por ahí), el fix del
doble disparo de `getStockedProductsForBranch` en Inventario, y `useCachedQuery`
(cache/dedupe/invalidación quirúrgica) para catálogos y gets puntuales.

**Servidor de desarrollo:** al final de esta sesión te doy el puerto exacto — hacé
**hard refresh** (Ctrl+Shift+R) antes de empezar, no se instaló ninguna dependencia
nueva pero sí cambió mucho código de servicios.

**Cómo cambiar de escenario:** igual que en `VERIFICACION_TANDA_0_1.md`/
`VERIFICACION_TANDA_2.md` — editá `FrontEnd/.env.local` (copiando el bloque que
corresponda de `.env.local.ejemplo-verificacion`), reiniciá el servidor, recargá.

---

### 1. Inventario → Clientes → Inventario: la segunda vez es instantánea

- Configurá el Escenario normal (sin `.env.local`, o el Escenario A).
- Andá a **Inventario** (`/inventario`), esperá a que cargue la tab "Stock Actual" por
  completo.
- Navegá a **Clientes** (`/clientes`), esperá a que cargue.
- Volvé a **Inventario**.
- **Qué deberías ver:** la segunda vez, Inventario aparece **instantáneo** — sin el
  `SkeletonTable` de carga, sin ningún parpadeo. Esto es lo que reportaste al inicio de
  esta tanda como el bug ("la segunda carga demora igual que la primera") — ahora no
  debería demorar nada.
- **Si no pasa esto:** si la segunda vez vuelve a mostrar el skeleton de carga durante
  varios cientos de ms, el cache no está funcionando — revisar `useCachedQuery` o que
  `staleTime` se esté pasando bien en `InventoryPage.tsx`.

### 2. Con `VITE_API_DEBUG=true`: contar los `start` del recorrido completo

- Configurá `VITE_API_DEBUG=true` (sin latencia alta, sin fallo forzado).
- Abrí la consola (F12) ANTES de navegar.
- Recorré, en orden: **Dashboard** (`/`) → **Inventario** (`/inventario`, tab default
  "Stock Actual") → **Clientes** (`/clientes`, tab default "Directorio") →
  **Inventario** de nuevo → **Compras** (`/compras`, listado principal).
- Contá cuántas líneas `[httpClient] req-N start` aparecen en total.
- **Qué deberías ver:** aproximadamente **6** líneas `start` en total (Dashboard: 1,
  primera vez en Inventario: 3 — productos, proveedores, stock de la sucursal —,
  Clientes: 1, segunda vez en Inventario: 0, Compras: 1 más por su propio listado
  paginado; productos/proveedores en Compras no deberían generar `start` nuevo, ya
  están en cache desde Inventario). Contando solo productos+proveedores+stock (las 3
  funciones que antes se repetían 12 veces en total en este mismo recorrido, según
  `RELEVAMIENTO_CACHE.md`), debería dar **3**, no 12.
- **Si no pasa esto:** si el número es mucho más alto que 6 (cerca de los ~12-15 de
  antes), algo no está deduplicando — anotá exactamente cuántos `start` viste y de qué
  request (el `path` de cada línea lo dice) para que pueda comparar contra lo esperado.

### 3. Todos los servicios ahora aparecen en consola (antes solo Proveedores)

- Con `VITE_API_DEBUG=true` todavía activo, mirá las líneas `start` del punto 2.
- **Qué deberías ver:** líneas con `path` de **todos** estos módulos apareciendo en
  algún momento del recorrido: `/dashboard`, `/products`, `/suppliers`, `/clients`,
  `/purchase-orders` (o `/products/stock-by-branch/...`, según qué pantallas
  visitaste) — no solo `/suppliers` como pasaba antes de esta tanda.
- **Si no pasa esto:** si seguís viendo `start` únicamente para rutas de
  `/suppliers`, alguno de los 5 servicios migrados no está pasando por `httpClient` de
  verdad — anotá cuál falta.

### 4. Crear un producto en Inventario se refleja en el modal de Pedidos

- Andá a **Inventario** (`/inventario`), click en "Nuevo Producto", completá los
  campos obligatorios (SKU, código de barras, nombre, etc. — los que pida el
  formulario) con datos de prueba, guardá.
- **Qué deberías ver:** el producto nuevo aparece en la tabla de Inventario sin
  recargar la página (esto ya funcionaba antes).
- Sin recargar la página, andá a **Pedidos** (`/pedidos`) y abrí "Nuevo Pedido"
  (el modal de creación de pedido).
- **Qué deberías ver:** el producto que acabás de crear en Inventario **aparece en
  la lista de productos** del modal de Pedidos, sin haber recargado la página en
  ningún momento — es la prueba directa de que el catálogo de productos está
  deduplicado/cacheado entre módulos, y que la invalidación por mutación funciona.
- **Si no pasa esto:** si el producto nuevo NO aparece en el modal de Pedidos (o
  aparece la lista vieja), la invalidación de la key `products` no está disparando —
  revisar `InventoryPage.tsx#invalidateProductCaches`.

### 5. Cambiar de sucursal actualiza el stock pero no reprocesa el catálogo

- Con `VITE_API_DEBUG=true`, andá a **Inventario**, esperá a que cargue. Anotá los
  `req-N` que aparecieron (productos, proveedores, stock).
- Cambiá de sucursal con el selector del Header.
- **Qué deberías ver:** aparece una línea `start` **nueva** para `/products/stock-by-branch/...`
  (el stock se vuelve a pedir, ahora para la sucursal nueva) — pero **NO** aparecen
  líneas `start` nuevas para `/products` ni `/suppliers` (el catálogo y la lista de
  proveedores no se repiten, porque no dependen de la sucursal — decisión ya
  confirmada: el catálogo es de empresa).
- **Si no pasa esto:** si cambiar de sucursal dispara `start` nuevos también para
  `/products`/`/suppliers`, algo está invalidando de más (revisar que el registro en
  `resettableStores`/`queryClient.ts` de Tanda 2, que es un barrido total, no esté
  interfiriendo — aunque a propósito SÍ debería barrer todo, así que si pasa esto,
  puede ser el comportamiento correcto de ese barrido total en cambio de sucursal, no
  un bug — avisame igual para que lo evalуemos juntos).

### 6. `VITE_MOCK_LATENCY_MS` afecta ahora a TODOS los módulos, no solo Proveedores

- Configurá `VITE_MOCK_LATENCY_MS=3000` (Escenario de latencia alta).
- Andá a **Inventario**, **Clientes**, **Compras**, **Logística**, **Dashboard** —
  uno por uno, cada uno por primera vez en la sesión (recargá la página completa
  entre cada uno, F5, para forzar una carga fresca sin cache).
- **Qué deberías ver:** en TODOS, la primera carga demora ~3 segundos (antes de esta
  tanda, solo Proveedores respetaba esta variable — el resto tenía un delay fijo de
  400-800ms sin importar esta configuración).
- **Si no pasa esto:** si algún módulo sigue cargando casi instantáneo a pesar de los
  3000ms configurados, ese servicio específico no quedó migrado a `httpClient` —
  anotá cuál.

### 7. Los 7 listados paginados siguen funcionando igual

- Recorré los 7 listados ya migrados a `usePagedQuery` (Tanda 1/2, sin tocar en esta
  tanda): Proveedores, Cuentas Corrientes, Clientes Morosos, Compras (listado
  principal), Pendientes de Recepción, Logística, Bajo Stock Mínimo.
- **Qué deberías ver:** carga, paginación, búsqueda y orden funcionan exactamente
  igual que antes de esta tanda — ninguno de estos 7 fue tocado en su código, pero
  ahora `getClientAccountsPage`/`getOverdueClientsPage`/`getPurchaseOrdersPage`/
  `getDeliveriesPage`/`getLowStockPage` pasan por `httpClient` por dentro (antes solo
  `fetchSuppliersPage` lo hacía) — deberían verse en consola con `VITE_API_DEBUG=true`
  también, y respetar `VITE_MOCK_LATENCY_MS`.
- **Si no pasa esto:** cualquier regresión visible en estos 7 (algo que cargaba y
  ahora no, un orden que dejó de funcionar) es prioritario — anotá cuál listado y qué
  acción puntual falla.

---

## Tabla de resultados

**Verificación parcial, 04/09/2026 (Leandro).**

| Punto | Resultado | Notas |
|---|---|---|
| 1. Inventario→Clientes→Inventario: segunda vez instantánea | Verificado | La segunda carga es instantánea — el problema reportado que originó esta tanda quedó resuelto. |
| 2. Conteo de `start` en el recorrido completo (~6, o 3 para productos/proveedores/stock) | No ejecutado | No se contaron los `start` en consola con `VITE_API_DEBUG=true` — el 12→3 sigue siendo análisis lógico, no medición. |
| 3. Todos los servicios aparecen en consola (no solo Proveedores) | No ejecutado | Requiere `VITE_API_DEBUG=true` y lectura de consola, no ejecutado (mismo motivo que el punto 2). Sí se confirmó, por separado, que las 9 pantallas cargan correctamente tras la migración de los 5 servicios — es evidencia indirecta de que la migración no rompió nada, pero no la verificación puntual de este ítem. |
| 4. Crear producto en Inventario se refleja en modal de Pedidos | Verificado | Se refleja sin recargar la página — la invalidación cruzada entre módulos funciona. |
| 5. Cambiar de sucursal actualiza stock, no reprocesa catálogo | No ejecutado | |
| 6. `VITE_MOCK_LATENCY_MS` afecta a todos los módulos | No ejecutado | |
| 7. Los 7 listados paginados siguen funcionando igual | No ejecutado | No se revisaron uno por uno con este criterio específico (carga/pagina/busca/ordena). Sí se confirmó, en general, que las 9 pantallas cargan correctamente. |
