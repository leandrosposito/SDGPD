# Guía de migración de módulo — capa `api/` + `usePagedQuery`

**Qué es esto:** la receta paso a paso para migrar cada uno de los listados pendientes (ver la lista al final) al mismo patrón que `suppliers` (Tanda 1 de escalabilidad): capa `api/` (`dto.ts`/`mapper.ts`/`<modulo>.service.ts`) + `httpClient` + `usePagedQuery` server-side + `ErrorState`/`LoadingState`. `suppliers` es la plantilla de referencia — cuando esta guía diga "copiá de suppliers", andá directo a `src/modules/suppliers/api/` y `src/modules/suppliers/SuppliersPage.tsx`.

**Para quién es:** cualquiera (yo en una sesión futura, u otra persona) que tenga que migrar uno de los 16 listados restantes sin haber estado presente en la Tanda 1. No asume contexto previo más allá de leer esto y mirar `suppliers` como ejemplo.

**Verificación funcional en navegador PENDIENTE (de `suppliers`, el propio piloto) — ver `docs/VERIFICACION_TANDA_0_1.md`.** Hasta que esa verificación no esté confirmada, tratá el patrón de `suppliers` como "compila y compila el tipo, pero no probado en navegador todavía" al copiarlo — si el checklist de esa verificación encuentra un problema, corregilo en `suppliers` (la plantilla) ANTES de replicarlo a un módulo nuevo, no lo arrastres.

**Actualización Tanda 2 (04/09/2026):** `usePagedQuery` ahora usa TanStack Query por dentro (cache, dedupe, invalidación cruzada al cambiar de sucursal/empresa) — la firma pública no cambió, así que el paso 4 de abajo (`usePagedQuery(fetchXPage, filters, options)`) sigue siendo literal, sin nada nuevo que aprender para migrar un módulo. Dos cosas sí cambian de verdad para un módulo nuevo, ver el paso 3 y la sección de Tropiezos actualizada: `fetchXPage` tiene que seguir siendo una función con nombre estable (ahora además de servir para las dependencias del efecto, su `.name` identifica la query en el cache — una arrow function anónima ya no solo dispararía un loop, rompería el cache), y ya no hace falta escribir a mano el `if (!session) return` para esperar `empresaId` en el listado paginado en sí (`usePagedQuery` lo resuelve solo) — pero seguí pasando `enabled: Boolean(empresaId)` explícito igual, es inofensivo y hace que la intención quede clara para quien lea el componente. Detalle completo del razonamiento en `docs/DECISIONES_TECNICAS.md`, entrada "Cache, dedupe e invalidación cruzada con TanStack Query".

---

## Orden exacto de archivos a crear, y qué copiar de `suppliers` en cada uno

Para un módulo nuevo `X` (ej. `orders`, `cash`), en este orden:

### 1. `modules/X/api/dto.ts`
Copiá la estructura de `modules/suppliers/api/dto.ts`, no su contenido. Definís:
- El/los tipo/s DTO de la entidad (`XDTO`), **deliberadamente distinto** del tipo de dominio (`shared/types/X.types.ts`) — ver la sección "Cómo definir el DTO" más abajo. No copies los nombres de campo de `SupplierDTO`, son específicos de proveedores.
- El envoltorio de página (`XPageDTO { data: XDTO[]; meta: { total, page, page_size } }`) — esta forma (`data`/`meta`) sí es genérica, podés copiarla literal.
- Si el módulo tiene alta/edición, los DTO de payload (`CreateXDTO`/`UpdateXDTO`) — mismo criterio que `CreateSupplierDTO`: solo los campos que el formulario realmente pide, no todo el DTO completo.

### 2. `modules/X/api/mapper.ts`
Copiá la estructura de `modules/suppliers/api/mapper.ts`:
- `xFromDTO(dto: XDTO): X` — DTO→dominio, la dirección que de verdad usaría un backend real.
- `xToDTO(x: X): XDTO` — dominio→DTO, usada SOLO para sembrar el mock (ver paso 3) a partir del `data/mock/X.data.ts` que ya existe en forma de dominio. Un backend real nunca la necesitaría.
- El tipo de input de formulario (`XFormInput`, ej. `Pick<X, 'campo1'|'campo2'>`) **vive acá, no en `X.service.ts`** — ver "Ciclo de import" en Tropiezos más abajo, es el error concreto en el que se cayó en Tanda 1.

### 3. `modules/X/api/X.service.ts`
Copiá la estructura completa de `modules/suppliers/api/suppliers.service.ts`:
- `XQueryFilters` (con `empresaId` obligatorio siempre, `branchId` solo si corresponde — ver la sección de scope más abajo) y `XSortField` (los campos por los que el listado permite ordenar).
- Un store de módulo en espacio DTO (`let xDTOStore: XDTO[] = X_MOCK_DATA.map(xToDTO)`), sembrado una sola vez desde `data/mock/X.data.ts`.
- `matchesFilters`/`compareX` operando sobre el DTO (no el dominio) — un backend real filtra/ordena sobre SU storage, no sobre el shape que consume el frontend.
- `filterAndSortX` compartida entre el resolver paginado y el export (no se duplica).
- `fetchXPage(query, signal?)` — firma exacta `(query: PageQuery<XQueryFilters, XSortField>, signal?: AbortSignal) => Promise<PageResult<X, TAggregates>>`, llama a `httpClient.request` con `mock: () => resolveMockXPage(query)`. **Desde Tanda 2:** tiene que ser una `function` con nombre o una `const` exportada con nombre estable (nunca una arrow function inline al llamar a `usePagedQuery`) — `usePagedQuery` usa `fetchXPage.name` para identificar el listado dentro del cache de TanStack Query; una función anónima o cuyo nombre cambie entre renders rompe la identidad del cache, no solo dispara un loop como con el `useEffect` anterior.
- `exportX(filters, sort?)` si el listado tiene botón de exportar (reusa `filterAndSortX`, no duplica).
- `createX`/`updateX` si el módulo tiene alta/edición, recibiendo `empresaId` como primer parámetro explícito, cada uno vía `httpClient.request` con su propio `mock`.

### 4. La página/componente del listado (`modules/X/XPage.tsx` o el componente que hoy tenga los datos)
- Reemplazar el `useState` + `useEffect` con `fetch` directo (o el import de `data/mock/X.data.ts`) por `usePagedQuery(fetchXPage, filters, { enabled: Boolean(empresaId) })` — mismo patrón que `SuppliersPage.tsx`.
- `filters` memoizado con `useMemo`, incluyendo `empresaId: session?.company.id ?? ''` (o `branchId` si corresponde).
- Reemplazar cualquier loading/error ad-hoc por `LoadingState`/`ErrorState` (`shared/components/ui/`) — mismo patrón condicional que `SuppliersPage.tsx`: `!empresaId || isLoading ? <LoadingState/> : error ? <ErrorState onRetry={refetch}/> : <contenido>`.
- Envolver la tabla en `ErrorBoundary` (ya existía el patrón antes de esta tanda) y `FetchingOverlay` (para refetches sin vaciar la tabla).
- Si la tabla tenía orden client-side propio (`useState` + `.sort()` local, como tenía `SuppliersTable` antes de migrarse), pasarlo a recibir `sort`/`onSortChange` como props y delegar en `usePagedQuery#setSort` — ver el diff de `SuppliersTable.tsx` en el commit de Tanda 1 como referencia exacta.
- Agregar `<Pagination>` si no la tenía.

### 5. Repuntear imports en módulos ajenos, si corresponde
Si otro módulo importaba el service viejo de `X` (ej. `orders` podría ser importado por algo de `dashboard`, revisar con `grep -rln "services/mock/X.service\|from '@/data/mock/X" src` antes de migrar), repuntear esos imports al nuevo `modules/X/api/X.service.ts` — ver el paso análogo que se hizo con `ComprasPage.tsx`/`InventoryPage.tsx` en Tanda 1 (sección "Tropiezos" más abajo).

### 6. Borrar el service viejo, si existía uno
Si el módulo ya tenía un `services/mock/X.service.ts`, borrarlo por completo una vez repunteados todos los consumidores — no dejarlo en paralelo (dos fuentes de verdad para el mismo dominio). Si el módulo leía `data/mock/X.data.ts` directo desde el componente (sin ningún service, como `orders`/`cash`/`analytics`/`settings` hoy), no hay nada que borrar, solo el import directo a reemplazar.

---

## Cómo decidir si la entidad es de empresa o de sucursal

Esto cambia el contrato de `XQueryFilters` (con `branchId` o sin él) y hay que decidirlo **antes** de escribir el DTO, no después — cambiarlo después significa retocar filtro, mock y UI.

**Preguntá:** *¿tiene sentido que dos sucursales de la misma empresa vean datos distintos de esta entidad?*

- **Si NO** (la entidad describe algo de la empresa como un todo — un proveedor, un cliente, un usuario del sistema, la configuración de la cuenta): sin `branchId` en los filtros. Precedentes ya confirmados en el proyecto: `ClientAccount` (M9, `DECISIONES_TECNICAS.md`), `Supplier` (Tanda 1, confirmado explícitamente con el usuario antes de implementar — no se asumió). Candidatos con este criterio entre los pendientes: **Clientes — Directorio** (mismo dominio que `ClientAccount`, ya con precedente), **Configuración** (usuarios/roles, suscripción, auditoría — son de la empresa por definición), **Pedidos** (a confirmar — un pedido probablemente sí tiene sucursal de origen, pero el LISTADO general podría no filtrar por sucursal activa, igual que Compras no filtra su listado general aunque `PurchaseOrder.branchId` existe — ver O5 en `DECISIONES_TECNICAS.md`. **No asumas, preguntá si no es obvio por el propio tipo de dominio.**).
- **Si SÍ** (la entidad tiene una ubicación física real — stock, entregas, caja de una sucursal): `branchId` obligatorio en los filtros, mismo patrón que `Delivery`/`ProductStock`. Candidatos: **Caja** (una caja es de una sucursal física), **Inventario — Stock Actual/Reposición/Categorías/Movimientos/Lotes/Historial** (todo lo que ya tiene relación con `ProductStock`, que sí es por sucursal — E1, `DECISIONES_TECNICAS.md`).
- **Cuando no sea obvio por el propio dominio:** preguntale al usuario antes de implementar, como se hizo en Tanda 1 para `suppliers` (`AskUserQuestion`, no una suposición) — es una decisión de producto, no de código, y equivocarse significa rehacer el contrato que van a copiar los módulos siguientes.

---

## Cómo definir el DTO cuando no se conoce el backend real

No hay forma de "acertarle" a la forma exacta que tendrá un backend que todavía no existe — y no es el objetivo. El objetivo es que el DTO sea **genuinamente distinto** del tipo de dominio, para que:
1. El mapper tenga algo real que traducir (si el DTO es un alias 1:1 del dominio con otro nombre de tipo, la "capa" no prueba nada — es indistinguible de no tener mapper).
2. El día que el backend real exista, el ajuste sea "cambiar los nombres de campo en `dto.ts`/`mapper.ts`", no "descubrir que el resto del código asumía que el dominio y la respuesta HTTP eran la misma cosa" (exactamente el hallazgo #1 de la auditoría).

**Convención usada en `SupplierDTO` — replicarla, no reinventar otra por módulo:**
- snake_case en los nombres de campo (`razon_social`, no `razonSocial`) — convención típica de APIs REST en español/Latam, y visualmente muy distinta de los nombres en camelCase del dominio, así un `grep` rápido confirma que nadie está leyendo el DTO directo.
- Agrupar campos relacionados en objetos anidados cuando tiene sentido conceptual (`contacto: {nombre, email}`, `direccion: {calle, ciudad}`) en vez de plano — un backend real normaliza así, no como una fila plana de spreadsheet.
- El envoltorio de lista es siempre `{ data: XDTO[], meta: { total, page, page_size } }` — no reusar `PageResult` (`shared/types/pagination.types.ts`) para esto: `PageResult` es el contrato YA INTERNO del frontend, `XPageDTO` es la forma de la respuesta HTTP cruda que el mapper traduce a `PageResult` dentro del service.

---

## Tropiezos concretos de la Tanda 1 — para no repetirlos

### Ciclo de import entre `mapper.ts` y `X.service.ts`
**El error:** `XFormInput` se definió primero en `X.service.ts` (donde siempre había vivido antes de la migración), y `mapper.ts` lo importaba desde ahí para su función `xFormInputToDTO`. Como `X.service.ts` a su vez importa `mapper.ts` (para `xFromDTO`/`xToDTO`), eso arma un ciclo.

**El fix:** `XFormInput` vive en `mapper.ts` (que no depende de nada del service), y `X.service.ts` lo re-exporta (`export type { XFormInput }`) para que los consumidores externos (el formulario) lo sigan importando desde el service, su punto de entrada público. **Empezá por acá:** definí `XFormInput` en `mapper.ts` desde el primer borrador, no lo muevas después de encontrarte con el ciclo.

### `usePagedQuery` sigue pasando `signal` a `fetchPage` (desde Tanda 2, viene de TanStack Query, no de un `AbortController` manual)
`usePagedQuery.ts` (`shared/hooks/`) le sigue pasando un `AbortSignal` como segundo argumento a `fetchPage` — **no hace falta tocarlo de nuevo** para un módulo nuevo. Tu `fetchXPage(query, signal?)` puede declarar el segundo parámetro y pasarlo a `httpClient.request({ signal, ... })` para cancelación real, o ignorarlo si por algún motivo tu módulo no lo necesita todavía — TypeScript permite ambas firmas indistintamente. Lo único que cambió por dentro (Tanda 2): antes ese `signal` salía de un `AbortController` creado a mano en un `useEffect`; ahora sale de `useQuery` (TanStack Query), que lo cancela solo cuando corresponde (componente desmontado, o la query queda sin observadores porque cambiaron los filtros/página). Para quien escribe `fetchXPage`, es exactamente el mismo contrato de antes — no hay nada que adaptar.

### `usePagedQuery` ya espera a que `empresaId` exista (Tanda 2) — pero seguí pasando `enabled: Boolean(empresaId)` igual
Desde Tanda 2, `usePagedQuery` lee `empresaId` de `useSessionStore` internamente (lo necesita para la query key del cache, ver `DECISIONES_TECNICAS.md`) y no dispara ningún fetch hasta que existe — esto ya cubre, para CUALQUIER listado paginado nuevo, la espera a que la sesión cargue, sin que tengas que escribir nada extra para el listado en sí. Igual seguí pasando `enabled: Boolean(empresaId)` explícito en tu página (mismo patrón que `SuppliersPage.tsx`) — es redundante con lo que ya hace el hook por dentro, pero deja la intención explícita para quien lea el componente sin tener que saber cómo funciona `usePagedQuery` por dentro.

Esto NO cubre otras llamadas a servicios fuera de `usePagedQuery` (ej. un `fetchX()` suelto para un dato no paginado, o una mutación como `createX`/`updateX`) — esas siguen necesitando el patrón manual de abajo si requieren `empresaId`.

### Repunteo de imports en módulos ajenos al que estás migrando
Antes de borrar un service viejo, `grep -rln "services/mock/X.service" src` (o `data/mock/X.data` si no había service) sobre **todo** `src`, no solo el módulo que estás migrando — en Tanda 1, `ComprasPage.tsx` e `InventoryPage.tsx` (ninguno de los dos es `suppliers`) importaban `fetchSuppliers` del service viejo. Repuntealos al import nuevo (`@/modules/X/api/X.service`) — es un import de servicio entre módulos, no de componente, así que no viola R2 (mismo patrón ya usado antes de esta tanda, ver O4 en `DECISIONES_TECNICAS.md`). Si esos archivos ajenos llaman a una función que ahora requiere `empresaId`, van a necesitar leer `session` de `useSessionStore` y esperar a que esté cargada (ver el punto siguiente) — es un cambio mínimo de esos archivos (agregar el parámetro), no una migración completa de ese módulo ajeno.

### Esperar a que la sesión cargue antes de llamar servicios que requieren `empresaId` (fuera de `usePagedQuery`)
Para el listado paginado en sí, esto ya lo resuelve `usePagedQuery` solo (ver arriba, Tanda 2). Este patrón sigue haciendo falta para cualquier OTRA llamada a un service que requiera `empresaId` fuera del hook — una mutación (`createX`/`updateX`) o un fetch suelto no paginado. Cualquier función de `X.service.ts` que ahora recibe `empresaId` obligatorio no se puede llamar con un valor vacío solo porque `session` todavía no cargó (`useSessionStore`, carga async al montar `AppShell`). Patrón a copiar (de `ComprasPage.tsx`/`InventoryPage.tsx`, repunteados en Tanda 1):
```ts
const session = useSessionStore((s) => s.session);

useEffect(() => {
  if (!session) return; // espera a que cargue; el efecto se re-corre solo cuando deja de ser null
  // ... llamar a fetchX(session.company.id) / lo que corresponda
}, [session]);
```
Para el listado paginado en sí, `usePagedQuery(fetchXPage, filters, { enabled: Boolean(empresaId) })` ya resuelve esto — no dispara el primer fetch hasta que `empresaId` exista.

---

## Checklist de cierre por módulo

Antes de dar un módulo por migrado:
- [ ] `npx tsc -b` — 0 errores.
- [ ] `npm run lint` — 0 errores (el warning preexistente de `PurchaseOrderFormModal.tsx` puede seguir apareciendo, no es tuyo).
- [ ] `npm run build` — pasa sin errores nuevos.
- [ ] `grep -rn "from '@/data/mock/X" src/modules` — 0 resultados fuera de `modules/X/api/X.service.ts` (ningún componente debe importar el mock directo).
- [ ] Ningún selector de zustand nuevo viola Z2 (`?? []`/`.map`/`.filter`/objeto-literal dentro de `use*Store((s) => ...)`) — el lint ya lo marca como warning (`no-restricted-syntax`), pero revisalo a ojo igual.
- [ ] Checklist de verificación manual en navegador (armar uno nuevo tipo `docs/VERIFICACION_TANDA_0_1.md`, o extender ese mismo archivo con una sección nueva) cubriendo como mínimo: carga/pagina/busca/ordena, `LoadingState` visible con latencia alta, `ErrorState` + reintento con fallo forzado, y si el módulo tiene alta/edición, que el listado se refresque solo tras guardar.
- [ ] Si el módulo tenía un service viejo, confirmar que se borró y que no quedó ningún import roto (`npx tsc -b` ya lo cubre, pero un `grep` del nombre del archivo viejo no está de más).

---

## Listados pendientes (15 según el conteo de la auditoría, 16 a nivel de archivo — ver nota)

**Nota de reconciliación, para que no se lea como un error de conteo:** `AUDITORIA_ESCALABILIDAD.md` (A2) describe el bucket "sin paginar" con el número **16** en su texto (incluyendo a `suppliers`, ya migrado en esta tanda: 16 − 1 = **15** conceptualmente). La tabla de A2, sin embargo, tiene **15 filas** en ese bucket (incluyendo `suppliers`) porque agrupa las 3 sub-vistas de "Configuración" en una sola fila — a nivel de **archivo** (la granularidad que importa para migrar, porque usuarios/roles, suscripción y auditoría son 3 dominios sin relación entre sí que probablemente necesiten 3 DTOs distintos) son **16 archivos** restantes, no 15. Se deja esta nota en vez de forzar el número a coincidir — la lista de abajo es por archivo, que es la que efectivamente hay que tachar una por una.

- [ ] `src/modules/clients/ClientsPage.tsx` (+ `components/ClientDirectoryTable.tsx`) — Directorio de Clientes. **Sin `branchId`** (mismo dominio que `ClientAccount`, ya confirmado M9).
- [ ] `src/modules/orders/OrdersPage.tsx` — Pedidos. Decidir scope empresa/sucursal antes de implementar (no es obvio, ver sección de arriba).
- [ ] `src/modules/cash/CashPage.tsx` — Caja. Probablemente **con `branchId`** (una caja es de una sucursal física) — confirmar igual, no asumir.
- [ ] `src/modules/analytics/AnalyticsPage.tsx` — Analítica. Mayormente gráficos/KPIs, no una tabla paginable clásica — evaluar si aplica el mismo patrón o si necesita uno propio (agregados, no filas).
- [ ] `src/modules/settings/components/tabs/TabUsersRoles.tsx` — Configuración, Usuarios y Roles. **Sin `branchId`** (es de la empresa).
- [ ] `src/modules/settings/components/tabs/TabSubscription.tsx` — Configuración, Suscripción/Facturas. **Sin `branchId`**.
- [ ] `src/modules/settings/components/widgets/AuditLogWidget.tsx` — Configuración, Auditoría. **Sin `branchId`**.
- [ ] `src/modules/inventory/components/TabStockCurrent.tsx` — Inventario, Stock Actual. **Con `branchId`** (ya usa `getStockedProductsForBranch`, solo falta paginar).
- [ ] `src/modules/inventory/InventoryPage.tsx` (tab Reposición / `TabPurchases`) — **Con `branchId`**.
- [ ] `src/modules/inventory/components/TabCategories.tsx` — Inventario, Categorías. Evaluar si es de empresa (catálogo) o de sucursal (stock por categoría) antes de implementar.
- [ ] `src/modules/inventory/components/TabMovements.tsx` — Inventario, Movimientos. **Con `branchId`** (un movimiento de stock es de una sucursal).
- [ ] `src/modules/inventory/components/TabProductHistory.tsx` — Inventario, Historial del Producto. Evaluar scope antes de implementar.
- [ ] `src/modules/inventory/components/TabPriceLists.tsx` — Inventario, Listas de Precios. Probablemente **sin `branchId`** (el precio de lista es del catálogo, no de la sucursal) — confirmar.
- [ ] `src/modules/inventory/components/ProductLotsPanel.tsx` — Inventario, Lotes. **Con `branchId`** (un lote está físicamente en una sucursal).
- [ ] `src/modules/inventory/components/TabAdjustments.tsx` — Inventario, Ajustes de Stock. **Nota:** hoy es un formulario decorativo, no un listado — evaluar si "migrar" acá significa conectar el formulario a un service real (fuera del alcance de esta guía, que es sobre paginación) o si en algún momento gana una tabla de ajustes históricos que sí aplique este patrón.
- [ ] `src/modules/inventory/components/TabImportExport.tsx` — Inventario, Importar/Exportar. **Nota:** igual que el anterior, hoy son botones decorativos sin listado — no aplica esta guía tal cual hasta que exista una tabla real ahí.

---

**Verificación funcional en navegador PENDIENTE (del propio piloto `suppliers` que esta guía usa como plantilla) — ver `docs/VERIFICACION_TANDA_0_1.md`.** El cambio de Tanda 2 (cache/dedupe/invalidación vía TanStack Query, transparente para esta guía) tiene su propio checklist, también pendiente — ver `docs/VERIFICACION_TANDA_2.md`.
