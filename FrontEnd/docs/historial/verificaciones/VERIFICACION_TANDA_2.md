# Verificación funcional manual — Tanda 2 (cache, dedupe e invalidación con TanStack Query)

**Quién ejecuta esto:** vos, en el navegador. No requiere leer código — cada punto dice
exactamente qué configurar, qué hacer y qué mirar.

**Qué cubre:** el reemplazo interno de `usePagedQuery` (useState+useEffect → useQuery de
TanStack Query) sobre los 7 listados que ya lo usan: `SuppliersPage`, `ClientAccountsTable`,
`ClientOverdueTable`, `ComprasPage`, `LogisticsPage`, `TabPendingReceipt` (Compras),
`TabLowStock` (Inventario). La firma pública del hook no cambió — ninguno de los 7 fue
tocado — así que este checklist verifica que el comportamiento observable sigue siendo el
mismo, más las tres capacidades nuevas (cache, dedupe, invalidación cruzada).

**Servidor de desarrollo:** corriendo en **http://localhost:5173/** (PID 14488, verificado
por ruta — `FrontEnd\node_modules\vite\bin\vite.js`). Como esta tanda instaló una
dependencia nueva (`@tanstack/react-query`), hacé un **hard refresh** de la pestaña
(Ctrl+Shift+R) antes de empezar — evita que quede una versión vieja pre-bundleada por Vite
en caché del navegador.

**Consola del navegador:** varios puntos piden `VITE_API_DEBUG=true`. Igual que en
`VERIFICACION_TANDA_0_1.md`: creá/editá `FrontEnd/.env.local` (copiá el bloque de
`.env.local.ejemplo-verificacion` que corresponda), reiniciá el servidor
(`Ctrl+C` → `npm run dev`), recargá la pestaña. Vite no relee `.env*` en caliente.

---

### 1. Los 7 listados siguen cargando, paginando, buscando y ordenando igual que antes

- Recorré, uno por uno: **Proveedores** (`/proveedores`), **Cuentas Corrientes** y
  **Clientes Morosos** (`/clientes`), **Compras** (`/compras`, listado principal y tab
  "Pendientes de Recepción"), **Logística** (`/logistica`), **Inventario → Bajo Stock
  Mínimo** (`/inventario`, tab correspondiente).
- En cada uno: confirmá que la tabla carga, que los controles de paginación funcionan
  (cambiar de página, cambiar filas por página), que buscar/filtrar reduce las filas
  como antes, y que ordenar por columna (donde exista, hoy solo Proveedores tiene las 4
  columnas ordenables) sigue funcionando.
- **Qué deberías ver:** exactamente el mismo comportamiento que tenías antes de esta
  tanda — nada nuevo, nada roto.
- **Si no pasa esto:** anotá en qué listado y qué acción puntual falla — es la señal más
  directa de que algo en el mapeo de `usePagedQuery` no quedó equivalente.

### 2. Cache: volver a un listado ya visitado no vuelve a pedirlo

- Configurá el Escenario con `VITE_API_DEBUG=true` (sin latencia alta, sin fallo forzado).
- Andá a **Proveedores** (`/proveedores`), esperá a que cargue. Mirá la consola: debería
  aparecer una línea `[httpClient] req-N start` para esa carga.
- Navegá a otro módulo (ej. Dashboard) y volvé a Proveedores, **antes de que pasen 30
  segundos** (ese es el `staleTime` configurado).
- **Qué deberías ver:** la tabla aparece **instantánea**, sin ningún parpadeo de
  `LoadingState`, y en la consola **no aparece una línea `start` nueva** — el listado se
  sirvió del cache sin pedirle nada a `httpClient`.
- Repetí el mismo paso pero esperando **más de 30 segundos** antes de volver: ahí sí
  debería aparecer un `start` nuevo (el cache ya venció) — la tabla puede mostrar el dato
  viejo un instante mientras revalida, o recargar directamente, cualquiera de los dos es
  correcto.
- **Si no pasa esto:** si SIEMPRE aparece un `start` nuevo (incluso volviendo en menos de
  30s), el cache no está funcionando — revisar `staleTime` en `queryClient.ts` o que la
  query key se esté armando igual entre una carga y la otra (revisar `queryKeys.ts`).

### 3. Dedupe: dos componentes pidiendo el mismo dato disparan una sola petición

- Este punto es más fácil de verificar en el tab de **Compras** que tiene dos vistas
  sobre el mismo recurso: el listado principal (`/compras`) y el tab "Pendientes de
  Recepción" — ambos usan `getPurchaseOrdersPage`, pero con filtros distintos, así que
  **no** van a dedupearse entre sí (es lo esperado, los filtros son parte de la key).
- Para un caso real de dedupe necesitás dos componentes pidiendo la **misma** key al
  mismo tiempo. El caso más simple de forzar sin tocar código: abrí **dos pestañas**
  del navegador en la misma URL de un listado (ej. dos pestañas en `/proveedores`) que
  compartan el mismo `localStorage`/sesión — **esto NO va a dedupear** porque cada
  pestaña tiene su propio `QueryClient` en memoria (uno por proceso de renderer). No es
  un caso válido para este punto.
- Caso válido: dentro de la **misma pestaña**, si algún componente padre renderiza el
  mismo listado dos veces (hoy no hay un caso así en la UI armada). Si no encontrás un
  caso real para forzar esto a mano, marcá este punto como "No aplicable hoy" en la
  tabla — la garantía es de la librería (query key hasheada por valor, no por
  referencia), no algo que dependa de que exista un caso de uso doble en pantalla
  todavía.
- **Qué deberías ver, si lo forzás:** una sola línea `start` en consola aunque dos
  lugares hayan pedido el mismo dato al mismo tiempo.
- **Si no pasa esto:** dos líneas `start` con la misma query key involucrada — señal de
  que algo está rompiendo el hash de la key (ej. pasando un objeto `filters` nuevo por
  referencia en cada render sin memoizar, ver el aviso de `usePagedQuery.ts` sobre
  `useMemo`).

### 4. Invalidación: cambiar de sucursal descarta el cache y vuelve a pedir

- Configurá `VITE_API_DEBUG=true`.
- Andá a **Logística** (`/logistica`, es de sucursal — `branchId` viaja en el filtro),
  esperá a que cargue. Anotá qué línea `req-N` fue.
- Sin salir de la pantalla, cambiá de sucursal con el selector del Header.
- **Qué deberías ver:** la tabla se recarga (puede pasar por `LoadingState` o
  `FetchingOverlay` un instante) y aparece una línea `start` **nueva** en consola —
  el cambio de sucursal invalidó el cache de todos los listados, no solo el que tenías
  abierto.
- **Si no pasa esto:** si la tabla sigue mostrando los datos de la sucursal anterior sin
  ninguna línea `start` nueva, la invalidación por `resettableStores` no está
  disparando `queryClient.invalidateQueries()` — revisar `queryClient.ts`.

### 5. Aislamiento: la query key incluye `empresaId`

- No hay una forma de ver el cache de TanStack Query directamente en consola sin las
  DevTools (que esta tanda decidió no instalar) — este punto se verifica indirectamente.
- Con `VITE_API_DEBUG=true`, cargá cualquier listado y confirmá en la consola que las
  peticiones a `httpClient` resuelven con normalidad (no hay error de "empresaId
  faltante" ni la pantalla se queda en `LoadingState` para siempre) — eso confirma que
  el hook consiguió un `empresaId` antes de armar la key y disparar el fetch.
- **Qué deberías ver:** todo carga con normalidad, sin quedarse trabado en el estado de
  carga.
- **Si no pasa esto:** si CUALQUIER listado se queda permanentemente en `LoadingState` (
  nunca aparece la tabla ni un error), es señal de que `empresaId` nunca llegó a
  resolverse (sesión que no cargó, o `session.company.id` vacío) — la query nunca se
  habilita.

### 6. Cancelación: tipear rápido sigue cancelando

- Mismo procedimiento que el punto 12 de `VERIFICACION_TANDA_0_1.md`: `VITE_API_DEBUG=true`,
  latencia alta (`VITE_MOCK_LATENCY_MS=3000` del Escenario D), andá a **Proveedores**,
  tipeá rápido en el buscador (más rápido que el debounce de 300ms entre letras).
- **Qué deberías ver:** varias líneas `req-N start`, pero solo la última llega a
  `resolved` — las anteriores muestran `req-N cancelled` (no `error`).
- **Si no pasa esto:** si todas las líneas `start` llegan a `resolved` (nada se
  cancela), la cancelación automática de TanStack Query no está cortando el fetch
  anterior — revisar que `fetchPage` reciba y use el `signal` que le pasa `useQuery`
  (antes era un `AbortController` manual, ahora tiene que ser el de la query).

### 7. Mutar un proveedor refresca el listado sin recargar la página

- Mismo procedimiento que el punto 11 de `VERIFICACION_TANDA_0_1.md`: en `/proveedores`,
  dar de alta un proveedor de prueba.
- **Qué deberías ver:** el listado se refresca solo (sin F5) y muestra el proveedor
  nuevo — mismo comportamiento que antes de esta tanda, ahora vía `refetch()` de
  TanStack Query en vez del `refetchToken` manual anterior.
- **Si no pasa esto:** si el proveedor se crea (toast de éxito) pero no aparece en la
  tabla sin recargar la página a mano, `refetch()` dejó de disparar un fetch nuevo —
  revisar `usePagedQuery.ts`.

---

## Tabla de resultados

| Punto | Resultado | Notas |
|---|---|---|
| 1. Los 7 listados cargan/paginan/buscan/ordenan igual | | |
| 2. Cache: volver a un listado visitado no repite el fetch | | |
| 3. Dedupe: misma key, una sola petición | | |
| 4. Invalidación: cambio de sucursal descarta el cache | | |
| 5. Aislamiento: empresaId presente en la key (indirecto) | | |
| 6. Cancelación: tipeo rápido sigue cancelando | | |
| 7. Mutar un proveedor refresca el listado solo | | |
