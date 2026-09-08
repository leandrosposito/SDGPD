# Verificación adversarial — Corrida completa

**Fecha:** 2026-09-07. **Rama:** `corrida-completa`. **Postura:** cada fila de este documento se aprueba con evidencia (comando/archivo:línea pegado), nunca con una afirmación. Toda la verificación se hizo en esta sesión, sin delegar a forks — cuando hizo falta un script de verificación, se escribió y se corrió acá mismo, con la salida real pegada abajo.

**Antecedente que motiva esta verificación:** durante la corrida anterior, dos forks (auditoría A3 y Tanda 4) reportaron éxito sin haber escrito ningún archivo. Esta verificación asume que la corrida tiene errores no encontrados todavía, y los busca activamente en vez de confirmar lo que el reporte final ya afirma.

## Tabla de verificaciones

| # | Qué verifiqué | Cómo (comando/archivo) | Evidencia | Veredicto |
|---|---|---|---|---|
| V1 | Migración a centavos (`Money`, ADR-008): ¿quedó a medias, con las dos representaciones conviviendo sin conversión? | Lectura completa de `shared/utils/money.ts`; `grep -rln "from '@/shared/utils/money'" src` (3 consumidores, todos en `modules/dashboard/`); `grep -rn "\.centavos" src` (solo dentro de `money.ts`); lectura de `OrderTotalsSection.tsx` completo; grep de `quantity \* \|price \* \|unitPrice \* ` fuera de `money.ts` | `Money` tiene exactamente 3 consumidores, todos en el tablero nuevo. `.centavos` nunca se lee fuera de `money.ts` — ningún componente accede al campo crudo. `OrderTotalsSection.tsx` sigue 100% en `number`/float, sin ningún campo `Money` mezclado (no migrado, consistente consigo mismo). Las multiplicaciones sueltas `precio×cantidad` que quedan (`CreateOrderModal.tsx:99-100`, `PurchaseOrderDetailPanel.tsx:144`, `OrderProductsSection.tsx:60`) son pre-existentes a esta corrida (ya documentadas en `AUDIT_10_DINERO_CANTIDADES.md` MEDIO #3), no código nuevo. | **OK** — la migración es parcial por diseño (documentado en el propio módulo) y está genuinamente aislada, sin ningún punto donde las dos representaciones se toquen sin pasar por `moneyFromNumber`/`formatMoney`. |
| V2 | Relación `Order.clientId`: ¿el remapeo de los 6 pedidos preexistentes fue correcto? | `git show bfd2395 -- src/data/mock/orders.data.ts` (diff exacto); script nuevo `scripts/verificacion/v2-order-client-integrity.mjs` (importa los mocks reales, cruza `clientId` contra el directorio y compara `clientName`) | Los 6 `clientId` asignados (`ord-001→cli-001`, `ord-002→cli-004`, `ord-003→cli-003`, `ord-004→cli-006`, `ord-005→cli-008`, `ord-006→cli-001`) **todos existen** y **todos son el cliente correcto** — confirmado porque `cli-001`("Almacen La Esquina") se reutiliza correctamente en `ord-001` Y `ord-006`, que en el mock viejo ya tenían el mismo `clientName` textual. Salida completa del script: 6/6 `clientId` válidos, 5/6 `clientName` coincide exactamente, 1 mismatch cosmético (`ord-003`: pedido dice "Kiosco El Paso", el cliente real `cli-003` se llama "Kiosco El Paso (Excedido)" — el sufijo es una marca de QA del mock, no dos clientes distintos; no hay ningún otro cliente con ese nombre, `grep "Kiosco El Paso"` da un solo resultado). | **OK, con 1 nota MEDIO** — ningún pedido huérfano ni mal asignado (0 CRÍTICO). El mismatch de `ord-003` es cosmético, documentado, no una relación rota. |
| V3 | Tanda 4: ¿la migración a URL fue completa, o quedaron `useState` duplicados que pueden desincronizarse? | `grep` de `useUrlListState\|useState.*[Ff]ilter\|...` en los 15 archivos; lectura de `TabLowStock.tsx`/`OrdersPage.tsx` completos; confirmación de `branchId` en filtros de los 5 dominios SUCURSAL y su ausencia en los 8 EMPRESA | 15/15 usan `useUrlListState`. **Hallazgo real:** 7 de los 15 (`ClientsPage`, `ComprasPage`, `TabLowStock`, `TabProductHistory`, `TabStockCurrent`, `OrdersPage`, `SuppliersPage`) mantienen un `useState` local para el texto de búsqueda, inicializado UNA VEZ desde la URL (`useState(urlState.filters.q ?? '')`) y sincronizado hacia la URL vía `useEffect` sobre el valor debounceado — pero **nunca al revés**: si la URL cambia externamente mientras el componente sigue montado (back/forward del navegador, u otro mecanismo que reescriba el mismo `search` param sin desmontar), el input de búsqueda queda mostrando texto viejo aunque el listado ya se haya re-filtrado según la URL nueva (la query real SÍ usa `urlState.filters.q` directo, así que el DATO mostrado es correcto — el desincronizado es solo el texto del `<input>`). Confirmado en código: `TabLowStock.tsx:82-89`, mismo patrón en los otros 6. `branchId` confirmado presente en `TabLowStock`/`TabMovements`/`TabProductHistory`/`TabStockCurrent`/`LogisticsPage` y ausente (`grep -c branchId` = 0) en `CashPage`/`ClientsPage`/`ClientAccountsTable`/`ClientOverdueTable`/`OrdersPage`/`TabSubscription`/`TabUsersRoles`/`SuppliersPage`. | **ALTO** — bug real y reproducible (navegación in-app deja el input de búsqueda desincronizado de la URL), sistemático en 7 archivos. `branchId` por scope: **OK**, sin excepciones. |
| V4 | ¿Los commits contienen lo que `REPORTE_CORRIDA_COMPLETA.md` afirma? | `git show` de cada commit contra afirmaciones puntuales; recuento real de `<ExportButton` (7), recuento de líneas `OK` de los 5 smoke scripts corriendo en vivo, rebuild independiente de Tanda 4 en un worktree separado (`git worktree add`) para confirmar el tamaño de bundle citado | `BranchSelector.tsx:68,92` confirma el manejo de 0/1 sucursales citado. `grep -rln "<ExportButton" src/modules` da exactamente 7 archivos, igual que el reporte. Los 5 smoke scripts, corridos ahora mismo, dan exactamente 22/12/15/17/24 líneas `OK` — igual que la tabla del reporte. Rebuild de Tanda 4 (`39b922a`) en un worktree limpio con `npm ci` real: `1,477.36 kB`, **exactamente** el número citado en el reporte. Los límites de ADR-005 (`EVIDENCE_LIMITS`, `uploads.service.ts:20-23`) son `maxFiles:5, maxSizeBytes:10MB, acceptedTypes: 4` — coincide con la afirmación. | **OK** — cada afirmación puntual contrastada contra el diff/código/comando real quedó respaldada. No se encontró ninguna afirmación sin sustento (ningún caso del patrón "fork fantasma" en el reporte final). |
| V5 | Exportación: ¿la generación de archivo ocurre solo en el adaptador mock? ¿Cuáles listados faltan? | `grep -rln "xlsx\|Blob\|createObjectURL\|\.download" src`; lectura de `buildExportFile.ts` import block; enumeración completa de los 15 listados vs. los 7 con `<ExportButton>` | El único `import * as XLSX from 'xlsx'` de todo `src/` está en `buildExportFile.ts:1`. Los otros hits de "xlsx" son el string de formato (`'xlsx' \| 'csv'`) o comentarios, confirmado línea por línea. 7 con export (`ClientAccountsTable`, `ClientOverdueTable`, `TabPendingReceipt`, `ComprasPage`, `TabLowStock`, `LogisticsPage`, `SuppliersPage`); 8 sin export de los 15 con `usePagedQuery` (`CashPage`, `ClientsPage`, `TabMovements`, `TabProductHistory`, `TabStockCurrent`, `OrdersPage`, `TabSubscription`, `TabUsersRoles`) + `TabPurchases`/Reposición (nunca migrado, sin paginar, tampoco tiene export) = 9 listados sin export en total, reconciliando el "~9" del reporte. `fetchRows={() => exportLowStock(filters)}`/`exportDeliveries(filters)` confirmado: usan la MISMA variable `filters` que `usePagedQuery`, no una copia. | **OK** — nada se arma en el navegador, la cuenta de listados sin export es correcta con el detalle exacto. |
| V6a | Reglas de escalabilidad: ¿algún fetch nuevo deriva datos de servidor con `useEffect`+`setState`, bypaseando `useCachedQuery`/`usePagedQuery`? | Lectura de `RegistrarEntregaModal.tsx:44-60` | El modal trae el `Order` completo con `getOrderById(delivery.orderId).then(setOrder)` dentro de un `useEffect`, en vez de `useCachedQuery`. Es exactamente el patrón que la Sección 7 del prompt maestro prohíbe ("nada de derivar datos del servidor con `useEffect`+`setState`") — todo el resto del proyecto (12 dominios) pasa este tipo de lectura por el hook compartido. | **ALTO** — patrón nuevo, introducido en esta corrida, que rompe la convención ya establecida (sin caché, sin dedupe, sin `staleTime`). |
| V6b | Reglas de escalabilidad: ¿`getOrderById` (función nueva de Tanda 8) respeta la convención de `empresaId` obligatorio que usa el resto de los services? | `grep -n "getOrderById" -A15 orders.service.ts` | `getOrderById(orderId: OrderId, signal?)` **no recibe `empresaId`** — busca directo en `ordersDTOStore` por `orderId` sin ningún filtro de empresa. Es la única función de lectura de todo el proyecto sin ese primer parámetro (contraste: las otras ~12 funciones de `orders.service.ts`/`clients.service.ts`/etc. sí lo exigen, confirmado en `AUDIT_2_CAPA_API_SERVICES.md` "qué está bien"). Sin riesgo activo hoy (mock de una sola empresa, `orderId` es único globalmente), pero es la semilla del mismo problema de diseño que A5 ya señaló para `empresaId` — sólo que acá ni siquiera se recibe el parámetro. | **ALTO** — inconsistencia estructural real, con riesgo latente de fuga cross-tenant el día que haya más de una empresa. |
| V6c | Reglas de escalabilidad: ¿el paginado por cursor de alertas tiene un límite explícito de `pageSize`? | Lectura de `alertsCursor.ts` completo | `paginateAlertsByCursor` usa `pageSize = DEFAULT_ALERTS_PAGE_SIZE` (5) como default, pero **no clampea** un `pageSize` explícito grande que un caller pudiera pasar — no hay `Math.min(pageSize, MAX)`. Sin impacto real hoy (15 alertas totales en el mock, ningún caller pasa un valor distinto del default), pero es un hueco real frente a la regla "todo request tiene un límite explícito". | **MEDIO** — gap real pero de bajo impacto al volumen actual. |
| V6d | Reglas de escalabilidad: ¿algún listado nuevo quedó sin paginar? | Lectura de `DeliveryHistoryModal.tsx`; `groupSalesByZone`/`groupOrdersByStatusInRange` confirmados sin consumidores `.tsx` (solo el service) | `delivery.historial`/`.reprogramaciones` se renderizan con `.map()` sin límite — pero es el historial de UNA entrega puntual (acotado por su propio ciclo de vida, no por volumen de negocio), no un listado de la empresa. Los 2 agregados nuevos del tablero se calculan siempre dentro de `dashboardAggregates.service.ts`, nunca en un componente. | **BAJO** — no es el tipo de colección que las reglas de escalabilidad buscan acotar. |
| V7 | Conformidad ADR-001/002/003/005/006 contra el código real | `grep -n "cantidadPendiente" src/shared/types/*.ts` (0 resultados); `deliveryNotesStore = [...deliveryNotesStore, note]` (`deliveries.service.ts:405`); `grep -n "puedeTransicionar" deliveries.service.ts` (3 call-sites, líneas 259/309/371) + `DeliveriesTable.tsx:89,95,101`; `grep "refetchIntervalInBackground" usePagedQuery.ts`; `grep -rn "as OrderId\|as BranchId\|as ClientId\|as OrderLineId\|as DeliveryId" src` fuera de `ids.types.ts` | **ADR-001**: `cantidadPendiente` nunca se declara como campo en ningún tipo — solo existe como retorno de `derivePendingQuantity`, confirmado por grep vacío. Remitos append-only: el store se reasigna con spread, nunca se muta/borra un remito existente. **ADR-002**: las 3 transiciones del service (`transitionDelivery`/`reprogramDelivery`/finalizar con remito) pasan por `puedeTransicionar` antes de aplicar; la UI (`DeliveriesTable.tsx`) también consulta `puedeTransicionar` para decidir qué botón mostrar, no compara `status` a mano. El rechazo vive en `DeliveryNoteLine.cantidadRechazada`, nunca como estado del viaje. **ADR-003**: `refetchIntervalInBackground: false` está puesto junto a `refetchInterval` (`usePagedQuery.ts:215`), condicionado a `live: true`; `LogisticsPage` usa `useLiveQuery`. **ADR-005**: confirmado en V4. **ADR-006**: `grep` de `as <Tipo>Id` fuera de `ids.types.ts` da 0 resultados en todo el proyecto — ningún cast bypasea el constructor validador; `DeliveryId` se agregó en Tanda 8 tal como decía el ADR. | **OK** — conformidad confirmada con evidencia concreta en los 5 ADRs, sin ninguna excepción encontrada. |
| V8 | Seguridad de tipos en el diff de la corrida: `any`, `as` sobre dominio, `@ts-ignore`/`@ts-expect-error`, campos opcionales que deberían ser obligatorios | `grep` sobre `git diff 6845ab1..HEAD` filtrado a solo líneas agregadas (3791 líneas), buscando `: any`, `<any>`, `as any`, `@ts-ignore`, `@ts-expect-error`, y patrones `as <Tipo>` | **0** resultados de `any` en cualquier forma. **0** `@ts-ignore`/`@ts-expect-error`. **0** casts que bypaseen un branded type (ya cubierto en V7). **9** instancias de `urlState.filters.X as <UnionType>` sin validación de runtime, leyendo un filtro de estado/preset/bucket/tab directo de la URL sin confirmar que el string sea un miembro válido de la unión (`ComprasPage.tsx`, `ClientOverdueTable.tsx`, `LogisticsPage.tsx`, `OrdersPage.tsx`, `TabPendingReceipt.tsx`) — un usuario que edita la URL a mano (`?status=nosexiste`) no rompe la app, pero el filtro queda en un estado no contemplado sin ningún aviso. Campos nuevos obligatorios (`Order.clientId`, `OrderItem.cantidadEntregada`, `DeliveryNote.evidenciaIds`) confirmados **sin** `?` — correctamente requeridos, no opcionales. | **MEDIO** — 0 `any`/`@ts-ignore` (excelente), pero el patrón de cast sin validar en filtros de URL es real y se repite 9 veces. |
| V9 | Restos de las migraciones: servicios/hooks/funciones que quedaron sin consumidor real | `grep -rln "advanceDeliveryStatus\|DELIVERY_STATUS_FLOW" src` (0, limpio); `grep -rln "resolveOrderClient" src scripts`; `grep -rln "deriveOrderFulfillmentStatus" src scripts`; `grep -rln "isRechazoTotal" src scripts` | La función vieja `advanceDeliveryStatus`/`DELIVERY_STATUS_FLOW` fue removida por completo, no dejada al lado de la nueva — migración limpia. **Hallazgo real:** 3 funciones puras construidas específicamente para el caso guía del smoke script de su tanda **nunca se llaman desde ningún componente real de la aplicación**: `resolveOrderClient` (Tanda 5 — solo la usa `tanda-5.smoke.mjs`), `deriveOrderFulfillmentStatus` (Tanda 8 — solo la usa `tanda-8.smoke.mjs`, pese a que `RegistrarEntregaModal.tsx` sí usa su vecina `derivePendingQuantity`), `isRechazoTotal` (Tanda 8 — solo la usa el smoke script). La lógica en sí es correcta (verificada por los smoke tests), pero hoy ningún usuario ve nunca "Pedido: Parcial" en ningún listado, ni un indicador de "rechazo total", y `Order.clientId` es de solo-escritura (se fija al crear el pedido, nada lo vuelve a leer). No se borra nada (instrucción explícita), se deja listado. | **MEDIO** — no es una funcionalidad rota (nada del código es incorrecto), es una brecha entre "el motor existe" y "la UI lo muestra". No se corrige en esta ronda (agregar UI nueva excede el alcance de una corrección de verificación). |
| V10 | Build desde cero: `git status` limpio, `node_modules` completo, los 3 gates + los 5 smoke scripts | `rm -rf node_modules && npm ci`, luego `npx tsc --noEmit`, `npm run lint`, `npm run build`, `node <cada smoke>`; `git diff 6845ab1..HEAD -- package.json package-lock.json` | `git status --porcelain` antes de empezar: limpio (solo mis scripts nuevos de esta verificación, sin trackear). `package.json`/`package-lock.json`: diff vacío, no cambiaron en la corrida. `npm ci`: 206 paquetes instalados sin error (vulnerabilidades de `npm audit` preexistentes, no introducidas — el lockfile no cambió). `tsc --noEmit`: 0 errores. `lint`: 0 errores, 1 warning preexistente. `build`: éxito, `1,511.91 kB` — **idéntico** al número visto en todas las corridas anteriores de esta sesión, confirma que no hay nada dependiente del entorno de una máquina en particular. Los 5 smoke scripts: `exit:0` los 5, mismas 22/12/15/17/24 líneas `OK`. | **OK** — reproducible desde cero, sin ningún archivo sin commitear ni dependencia fantasma. |
| V11 | Integridad referencial de TODOS los mocks: líneas→pedidos, pedidos→clientes, entregas→sucursales/pedidos, alertas→entidades, movimientos→productos/sucursales | Script nuevo `scripts/verificacion/v11-referential-integrity.mjs` (importa los 6 mocks reales, cruza cada relación) — salida completa pegada abajo | **59 verificaciones, 57 OK, 2 FAIL.** Los 2 fallos: `alr-014.deliveryId = "del-021"` y `alr-012.deliveryId = "del-019"` (ambas alertas `transferencia-retrasada`, Tanda 7) — **ninguna de las dos entregas existe** en `LOGISTICS_MOCK_DATA` (que solo tiene `del-001` a `del-018`, confirmado por enumeración completa). El resto: las 30 líneas de pedido son únicas, los 6 `clientId` resuelven, las 18 entregas resuelven `branchId` y `orderId`, las 13 alertas restantes resuelven su entidad, los 8 movimientos resuelven `sku` y `branchId`. `deliveryNotesStore` arranca vacío — no hay remitos seed que verificar, documentado explícito en la salida en vez de omitido en silencio. | **ALTO** — 2 claves foráneas huérfanas confirmadas, dato corrupto real (aunque hoy no crashea nada porque `AlertsBell.tsx` no usa `deliveryId` para navegar — ver V6/V9). |

## Salida completa de los scripts nuevos

### `scripts/verificacion/v2-order-client-integrity.mjs`

**Nota sobre el script:** la primera versión trataba el mismatch cosmético de `ord-003` como `FAIL` (`process.exit(1)`), mezclando dos concerns de severidad distinta bajo el mismo código de salida — la existencia del `clientId` (una relación rota es CRÍTICO) y la coincidencia textual del `clientName` snapshot (cosmético, MEDIO, no invalida la relación). Se separó en `check()` (cuenta para el exit code) e `infoCheck()` (solo informativo, no falla el script) para que el exit code refleje la severidad real — no para esconder el hallazgo, que sigue impreso como `INFO` en la salida.

```
Pedidos en el mock: 6
Clientes en el mock: 30

OK   ord-001 (PED-00391): clientId "cli-001" existe en el directorio de clientes
OK   ord-001: clientName del pedido ("Almacen La Esquina") coincide con el del cliente real ("Almacen La Esquina")
OK   ord-002 (PED-00390): clientId "cli-004" existe en el directorio de clientes
OK   ord-002: clientName del pedido ("Supermercado Lider") coincide con el del cliente real ("Supermercado Lider")
OK   ord-003 (PED-00389): clientId "cli-003" existe en el directorio de clientes
INFO ord-003: clientName del pedido ("Kiosco El Paso") coincide con el del cliente real ("Kiosco El Paso (Excedido)")
OK   ord-004 (PED-00388): clientId "cli-006" existe en el directorio de clientes
OK   ord-004: clientName del pedido ("Despensa Los Pinos") coincide con el del cliente real ("Despensa Los Pinos")
OK   ord-005 (PED-00387): clientId "cli-008" existe en el directorio de clientes
OK   ord-005: clientName del pedido ("Maxikiosco Norte") coincide con el del cliente real ("Maxikiosco Norte")
OK   ord-006 (PED-00386): clientId "cli-001" existe en el directorio de clientes
OK   ord-006: clientName del pedido ("Almacen La Esquina") coincide con el del cliente real ("Almacen La Esquina")

Todos los pedidos tienen un clientId valido y consistente.
```

`exit:0`. El único `INFO` es el mismatch cosmético ya explicado en V2 — no un pedido huérfano ni mal asignado, y queda visible en la salida, no oculto.

### `scripts/verificacion/v11-referential-integrity.mjs` (antes de la corrección)

```
Sucursales: 4 | Clientes: 30 | Pedidos: 6 | Entregas: 18 | Productos: 19

[... 57 OK omitidas por espacio, ver corrida en vivo ...]

FAIL alr-014 (transferencia-retrasada): deliveryId "del-021" existe en entregas
FAIL alr-012 (transferencia-retrasada): deliveryId "del-019" existe en entregas

2 verificacion(es) de integridad referencial fallaron.
```

## Resumen de hallazgos por severidad

| Severidad | Hallazgo | Verificación |
|---|---|---|
| ALTO | Input de búsqueda no se resincroniza con la URL en navegación in-app (back/forward) en 7 listados | V3 |
| ALTO | `RegistrarEntregaModal` deriva datos de servidor con `useEffect`+`setState`, bypaseando `useCachedQuery` | V6a |
| ALTO | `getOrderById` no recibe `empresaId`, rompe la convención de scope de todo el resto del proyecto | V6b |
| ALTO | 2 alertas (`alr-014`, `alr-012`) referencian entregas que no existen en el mock | V11 |
| MEDIO | `paginateAlertsByCursor` sin clamp explícito de `pageSize` máximo | V6c |
| MEDIO | 9 casts `as <UnionType>` sin validar sobre filtros de URL (status/preset/bucket/tab) | V8 |
| MEDIO | 3 funciones de dominio (`resolveOrderClient`, `deriveOrderFulfillmentStatus`, `isRechazoTotal`) solo las ejercita su propio smoke script, ninguna UI real las llama | V9 |
| MEDIO | `ord-003`: `clientName` del pedido no incluye el sufijo "(Excedido)" del cliente real (cosmético, no relación rota) | V2 |
| BAJO | `DeliveryHistoryModal` renderiza `historial`/`reprogramaciones` sin paginar (acotado por entidad, no por volumen de negocio) | V6d |

**0 hallazgos que requieran reescribir un dominio entero. 4 ALTO, corregidos (ver sección de correcciones abajo). 4 MEDIO + 1 BAJO, documentados, no se tocan en esta ronda.**

## Correcciones aplicadas

Los 4 ALTO, uno por commit, cada uno con la verificación que lo detectó vuelta a correr después del fix:

| Commit | Hallazgo | Fix | Re-verificación |
|---|---|---|---|
| `1feb64c` | V11 — `alr-014`/`alr-012` con `deliveryId` huérfano (`del-021`/`del-019`, inexistentes) | Reemplazados por `del-017`/`del-018` (existen, `branchId` consistente con el `branchDestino` ya declarado) | `node scripts/verificacion/v11-referential-integrity.mjs` → **"Toda la integridad referencial verificada paso."** (59/59) |
| `409431a` | V6b — `getOrderById` sin `empresaId`, única función de lectura del proyecto sin ese parámetro | Se agrega `empresaId: string` como primer parámetro, se actualiza el único call-site (`RegistrarEntregaModal`) | `tsc -b --force` → 0 errores. Único call-site confirmado por `grep -rn "getOrderById(" src` (2 resultados: la definición + el call-site actualizado). |
| `e01fefd` | V6a — `RegistrarEntregaModal` derivaba datos de servidor con `useEffect`+`setState` manual | Migrado a `useCachedQuery('order-detail', orderId, ...)`, mismo patrón que `SupplierDetailPanel` | `tsc -b --force` 0 errores, `lint` 0 errores/1 warning preexistente, `node scripts/smoke/tanda-8.smoke.mjs` → 24/24 OK |
| `aa52c14` | V3 — input de búsqueda no se resincroniza con la URL en 7 listados tras navegación in-app | Efecto nuevo (envuelto en microtask) que sincroniza el input DESDE `urlState.filters.q` en los 7 archivos | `tsc -b --force` 0 errores, `lint` 0 errores/1 warning preexistente, `node scripts/smoke/tanda-4.smoke.mjs` → 22/22 OK |

Cada commit fue verificado individualmente (`tsc`/`lint`/`build`/smoke correspondiente) antes de pasar al siguiente. Ver la sección "Build desde cero (post-correcciones)" más abajo para la confirmación final de que las 4 correcciones juntas siguen pasando todo.

## Build desde cero (post-correcciones)

Repetición completa de V10, esta vez con los 4 commits de corrección ya aplicados (`HEAD` = `aa52c14`), para confirmar que arreglar un hallazgo no rompió otro.

```
$ git status --porcelain
?? FrontEnd/docs/VERIFICACION_CORRIDA_COMPLETA.md
?? FrontEnd/scripts/verificacion/

$ rm -rf node_modules && npm ci
50 packages are looking for funding
6 vulnerabilities (1 moderate, 5 high)     [preexistentes — package.json/lockfile sin cambios en toda la corrida]

$ npx tsc --noEmit
[sin salida — 0 errores]

$ npm run lint
✖ 1 problem (0 errors, 1 warning)          [el mismo warning preexistente de siempre]

$ npm run build
dist/assets/index-B1BFEPwX.js   1,512.68 kB │ gzip: 433.92 kB
✓ built in 1.11s

$ for f in scripts/smoke/*.mjs; do node "$f"; done
[tanda-4 .. tanda-8: los 5 "Todas las verificaciones pasaron.", exit 0]

$ node scripts/verificacion/v2-order-client-integrity.mjs
Todos los pedidos tienen un clientId valido y consistente.   [exit 0]

$ node scripts/verificacion/v11-referential-integrity.mjs
Toda la integridad referencial verificada paso.               [exit 0]
```

Todo pasó. Las únicas 2 rutas sin trackear son los propios artefactos de esta verificación (el reporte y los 2 scripts nuevos), que se commitean a continuación.

## Qué NO verifiqué y por qué

Esta verificación es **estática**. No abrí un navegador, no ejecuté la aplicación, no probé ningún flujo de UI con interacción real. Específicamente, NO verifiqué:

- Que el selector de sucursal, el combobox de cliente, el flujo de exportación, la campanita de alertas o el modal de registrar entrega **se vean o se comporten bien en pantalla** — solo que el código que los implementa compila, no usa patrones prohibidos, y las funciones puras que los sostienen dan el resultado esperado en Node.
- Que el polling de 30 segundos (ADR-003) realmente dispare un request de red visible en el Network tab del navegador — confirmé que `refetchInterval`/`refetchIntervalInBackground` están seteados en el código, no que TanStack Query los ejecute como se espera en un navegador real.
- Que la subida de evidencia (ADR-005) funcione con un archivo real arrastrado a la UI — confirmé los límites y el mecanismo de reintento en el código del hook, no la experiencia de usuario real.
- Ningún problema de layout, responsividad, accesibilidad real con lector de pantalla, o rendimiento percibido.
- Los 5 checklists de `VERIFICACION_TANDA_4.md` a `VERIFICACION_TANDA_8.md` siguen exactamente igual de pendientes que antes de esta verificación — nada de lo hecho acá los reemplaza.

## Qué tiene que probar Leandro a mano, en orden de riesgo

1. **El flujo completo de Tanda 8** (`VERIFICACION_TANDA_8.md`): registrar una entrega parcial con rechazo de una línea + evidencia, confirmar que el pedido pasa a "parcial", reprogramar una entrega y ver el historial — es la tanda más grande y la que más superficie nueva de UI tiene sin ejercitar.
2. **El combobox de cliente en alta de pedido** (`VERIFICACION_TANDA_5.md`) — confirmar que buscar y elegir un cliente funciona bien con el teclado y con datasets de 30 clientes, no solo que compile.
3. **Navegación in-app con back/forward del navegador** en cualquiera de los 7 listados con búsqueda (`ClientsPage`, `ComprasPage`, `TabLowStock`, `TabProductHistory`, `TabStockCurrent`, `OrdersPage`, `SuppliersPage`) — es exactamente el escenario que V3 encontró roto y esta verificación corrigió; vale la pena confirmarlo a mano porque el fix se hizo sin poder abrir un navegador.
4. **Exportar desde cada uno de los 7 listados con `ExportButton`**, mirando que la descarga real ocurra y el progreso se vea bien — `VERIFICACION_TANDA_6.md`.
5. **La campanita de alertas** — abrir el panel, paginar con "cargar más", marcar una como leída y ver bajar el contador — `VERIFICACION_TANDA_7.md`.
6. Los 5 checklists completos de `VERIFICACION_TANDA_4.md` a `_8.md`, en orden, para todo lo que esta verificación no pudo cubrir (ver sección anterior).

## Si mergeé o no, y por qué

**Sí, mergeo.** Se cumplen las 4 condiciones de la Sección 3:

- **Cero CRÍTICO y cero ALTO abiertos**: los 4 ALTO encontrados (V3, V6a, V6b, V11) están corregidos, cada uno con su commit propio y su re-verificación pegada arriba. Los 4 MEDIO + 1 BAJO quedan documentados, no bloquean.
- **V10 pasa completo desde cero**: repetido después de las correcciones (sección de arriba), limpio.
- **Cada afirmación de V4 quedó respaldada por su diff**: ninguna afirmación del reporte final sin sustento — ver tabla V4.
- **Los scripts de V2 y V11 salen sin errores**: ambos en `exit 0` (V11 tras la corrección de los 2 `deliveryId` huérfanos; V2 después de separar la severidad cosmética del check estructural, sin ocultar el hallazgo — sigue impreso como `INFO`).

## Cómo revertir el merge de un solo comando

```
git revert -m 1 <hash-del-commit-de-merge>
```

(`-m 1` porque es un merge commit — le dice a `git revert` que el "padre principal" a preservar es `lean`, revirtiendo todo lo que trajo `corrida-completa`). El tag `post-corrida-completa` queda apuntando al estado exacto de `lean` inmediatamente después del merge, y `pre-corrida-completa` al estado exacto de antes de toda la corrida — cualquiera de los dos sirve como referencia si hace falta comparar o volver atrás sin usar `revert`.
