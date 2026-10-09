# REPORTE 2026-10-09 — Piloto de Graphify (FrontEnd/src)

> Verificado contra el filesystem el **2026-10-09**, sobre `origin/lean` en el commit `4d5ded2` (clone descartable `C:\proyectos\SDGPD-graphify`). Si leés esto después, reverificá: el código pudo moverse.

Sesión de evaluación de una herramienta externa. **No toca código de la aplicación.** No adopta la herramienta: el veredicto es un insumo para que Leandro decida.

---

## 1. Resumen

1. Graphify 0.9.82 (`graphifyy` vía `uv`) armó el grafo de `FrontEnd/src` en ~20 s, con AST local y sin ningún LLM: 1.668 nodos, 5.359 aristas, 98 % EXTRACTED. Al reconstruir, el resultado es idéntico byte a byte.
2. Recall de **100 %** en todas las preguntas de call-sites e imports (P1, P2, P4, P6, P7) y en E2. Precisión de las aristas **8/8** (E1).
3. Falla del todo en accesos a propiedades: en P3 (quién lee `isActive`) el recall es **0 %**. El grafo no tiene nodos de campos.
4. Tiene falsos positivos estructurales: en P2 no distingue exports de helpers privados (151 de 174) y en P4 resuelve `import './X.css'` al nodo `X.tsx` (7 de 33).
5. En bytes no gana: solo en **1 de 7** preguntas consume ≤ 50 % de lo que consume grep. **Veredicto: USO LIMITADO (solo mapa visual)**, según los umbrales fijados de antemano.

## 2. Instalación

| | |
|---|---|
| Paquete | `graphifyy` **0.9.82** (doble y), desde PyPI |
| Método | `uv tool install --python 3.12 --reinstall graphifyy` (uv 0.12.5 ya estaba instalado) |
| Intérprete | CPython **3.12.14** gestionado por uv (`C:\Users\leand\AppData\Roaming\uv\python\cpython-3.12-windows-x86_64-none`) |
| Binario | `C:\Users\leand\.local\bin\graphify.exe`. **Está bloqueado por el Control de aplicaciones de Windows (Smart App Control) y no se puede usar.** |
| **Forma de invocarlo en esta máquina** | `"C:\Users\leand\AppData\Roaming\uv\tools\graphifyy\Scripts\python.exe" -I -m graphify <comando>` |

Intentos de instalación (máximo 3, se usaron 2):

1. `uv tool install graphifyy`: se instaló sobre CPython 3.14.7. `graphify.exe` da `Permission denied` / *"Una directiva de Control de aplicaciones bloqueó este archivo"*. Con `python -m graphify --version` funciona, pero `extract` revienta con `AttributeError: module 'http.client' has no attribute 'HTTPSConnection'`. La causa es que Windows bloquea las DLLs nativas `_ssl`, `_ctypes` y `_hashlib` de ese build (`ImportError: DLL load failed while importing _ssl: Una directiva de Control de aplicaciones bloqueó este archivo`).
2. `uv python install 3.12` y prueba de las 3 DLLs (`OK _ctypes / OK _hashlib / OK _ssl`), después `uv tool install --python 3.12 --reinstall graphifyy`: **funciona**. El launcher `graphify.exe` sigue bloqueado incluso después de la reinstalación, porque es el trampolín de uv y no depende de la versión de Python. Por eso se invoca como módulo.

`-I` (modo aislado) evita que Python agregue el directorio actual al `sys.path`.

## 3. Grafo

**El grafo refleja `origin/lean` en el commit `4d5ded2f929128f40143e4a7d8b5118bf1ff358f`** (lo dice `graph.json` en `built_at_commit`), **sin los cambios en curso de BE-0b** que hay en `C:\proyectos\SDGPD`.

| | |
|---|---|
| Corpus | 250 archivos `.ts`/`.tsx` (119 `.tsx`), 1.338.069 bytes. Graphify saltó 76 archivos sin extensión soportada (`.css`, `.gitkeep`) |
| Comando | `extract ./src --code-only --out .` y después `cluster-only . --no-label` (desde `C:\proyectos\SDGPD-graphify\FrontEnd`) |
| Tiempo de build | extract **27,3 s** la primera vez y **17,6 s** al reconstruir (12 workers), más cluster-only **2,1 s** |
| Nodos | **1.668**: 633 callables, 431 clases/tipos, 429 otros (archivos, constantes) y 175 nodos "concept" (referencias a ADRs en comentarios) |
| Aristas | **5.359** |
| Comunidades | 71 (sin nombre: `Community N`, porque `--no-label` evita el LLM) |

Aristas por tipo:

| relation | cantidad | confidence |
|---|---:|---|
| imports | 1.428 | EXTRACTED |
| contains | 1.201 | EXTRACTED |
| imports_from | 1.197 | EXTRACTED |
| **calls** | **996** | EXTRACTED |
| references | 244 | EXTRACTED |
| cites | 140 | EXTRACTED |
| indirect_call | 108 | **INFERRED** (avg 0,85) |
| dynamic_import | 13 | EXTRACTED |
| re_exports | 12 | EXTRACTED |
| inherits | 12 | EXTRACTED |
| method | 8 | EXTRACTED |

**EXTRACTED 5.251 (98 %) / INFERRED 108 (2 %).** Todas las INFERRED son `indirect_call`, es decir, funciones pasadas como valor.

Archivos de salida, en `C:\proyectos\SDGPD-graphify\FrontEnd\graphify-out\` (ignorado por `.gitignore`):

| archivo | bytes |
|---|---:|
| graph.json | 2.844.537 |
| graph.html | 2.068.177 |
| GRAPH_REPORT.md | 20.804 |
| FrontEnd-callflow.html (C5, `export callflow-html`) | 382.806 |
| manifest.json, .graphify_analysis.json, cache/ | auxiliares |

**Para abrir en el navegador:** `C:\proyectos\SDGPD-graphify\FrontEnd\graphify-out\graph.html`. Necesita internet, porque carga `vis-network@9.1.6` desde unpkg. El callflow carga `mermaid@11` desde jsdelivr.

`GRAPH_REPORT.md` pesa más de 20 KB, así que se leyeron solo las primeras 80 líneas (regla C7). Esas líneas son casi todas la lista `Community 0..63`, y sin nombres de comunidad el reporte aporta poco.

## 4. Grafo vs grep, por pregunta

Los bytes son la salida consumida de cada comando (`| wc -c`). **Tokens ≈ bytes / 4. Es una aproximación, no una medición real de la API.** "Tool calls" cuenta comandos de consulta, no turnos.

| Pregunta | Total R | Aciertos G | Falsos neg. | Falsos pos. | Recall | Bytes G | Bytes R | Ratio G/R | Tool calls G/R |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| P1 llamadores de `fetchProducts` | 6 | 6 | 0 | 0 | **100 %** | 7.167 | 3.419 | 2,10 | 3 / 2 |
| P2 Gate 5: exports sin call-site externo | 23 | 23 | 0 | 151 | **100 %** | 9.960 | 1.396 | 7,13 | 2 / 3 |
| P3 quién **lee** `ClientAccount.isActive` | 6 | 0 | 6 | 1 | **0 %** | 3.302 | 4.611 | 0,72 | 2 / 1 |
| P4 dependientes de `usePagedQuery` | 26 | 26 | 0 | 7 | **100 %** | 5.133 | 9.291 | 0,55 | 1 / 5 |
| P5 rutas lazy desde AppRoutes | 13 | 13 (nivel archivo) | 0 | 0 | **100 %** archivo / 0 % símbolo | 5.408 | 1.680 | 3,22 | 1 / 1 |
| P6 camino CreateOrderModal → fetchProducts | 1 salto | 1 | 0 | 0 | **100 %** | 170 | 770 | **0,22** | 2 / 1 |
| P7 consumidores de los 3 services de `services/mock/` | 16 | 16 | 0 | 0 | **100 %** | 3.701 | 1.804 | 2,05 | 1 / 2 |

Bytes G ≤ 50 % de Bytes R: **solo P6 (1/7).**

Sensibilidad, para no castigar a G por comandos de más: si en cada pregunta se toma solo el comando G más barato que alcanza la respuesta (en P1, `affected --relation calls --depth 1` = 541 B → 0,16; en P3, el script = 379 B, aunque con recall 0), igual quedan como máximo 3 de 7 (P1, P3, P6). **El veredicto no cambia.**

### Respuestas

- **P1.** G y R coinciden en estos 6 llamadores:
  - `ComprasPage()` (ComprasPage.tsx:195)
  - `InventoryPage()` (InventoryPage.tsx:89)
  - `CreateOrderModal()` (CreateOrderModal.tsx:50)
  - `createOrder()` (orders.service.ts:317)
  - `getActiveProductIds()` (purchase-suggestions.service.ts:20)
  - `hasInactiveProduct()` (services/mock/purchaseOrders.service.ts:29)

  Nota: el dato "esperado" del 2026-10-07 (`getPurchaseSuggestionsPage`) está desactualizado. Hoy el llamador directo es el helper privado `getActiveProductIds`, que a su vez se invoca desde purchase-suggestions.service.ts:65 y :94. Además aparecen dos llamadores de UI que el texto no mencionaba (ComprasPage, InventoryPage). El mejor comando fue `affected "fetchProducts" --relation calls --depth 1`. `query "who calls fetchProducts"` hace un BFS de profundidad 2 y devuelve 70 nodos, la mayoría ruido.
- **P2.** R encontró 210 funciones exportadas en `shared/**` y `modules/*/api/**`, de las cuales **23 no tienen ningún uso fuera de su archivo**:
  - `sortAlertsByRecency`, `exportJobStepAt`, `defaultDateRangeValue`, `SkeletonCard`
  - `parsePageParam`, `serializePageParam`, `parseSortParam`, `serializeSortParam`
  - los 11 `is*Id` de `ids.types.ts`
  - `sumMoney`, `multiplyMoney`, `parseMoneyInput`
  - `extractOrderNumberSuffix`

  G las encontró las 23 dentro de una lista de 174. Los otros 151 **no son exports** (ver §5). Controles de R: ninguno de los 210 se usa solo en comentarios ni solo a través de homónimos. Ningún export que sí se usa aparece en G como huérfano, así que G no tiene falsos "huérfanos" entre los exports. `scripts/smoke` no está en `src/`, así que no cuenta ni en G ni en R.
- **P3.** R encontró 6 lectores:
  - `modules/clients/api/mapper.ts:101` (`clientToDTO`)
  - `ClientsPage.tsx:74` (accessor de export)
  - `ClientDirectoryTable.tsx:37-38`
  - `CreateClientModal.tsx:92`
  - `orders.service.ts:316` (`createOrder`)
  - `shared/utils/orderEligibility.ts:37` (`isClientSelectableForOrder`)

  Se excluyen las escrituras (`mapper.ts:61` y `data/mock/clients.data.ts`), `mapper.ts:132` (que lee `input.isActive`, otro tipo) y los `isActive` locales de Tabs, BranchSelector y Sidebar. G no encontró **ninguno**. El único match fue `ClientsPage.tsx:isActiveTab`, una función local que no tiene nada que ver.
- **P4.** R encontró 26 dependientes:
  - 19 directos: 18 componentes más el wrapper `useLiveQuery`
  - 2 vía `useLiveQuery`: `LogisticsPage`, `TripDetailPanel`
  - 2 vía JSX: `InventoryPage` (renderiza los Tab*) y `SettingsPage` (renderiza `TabSubscription`/`TabUsersRoles`)
  - la cadena de rutas: `AppRoutes`, `App`, `main`

  G los encontró los 26 (los saltos JSX aparecen como `calls`). Sumó 7 falsos: `TabCommercial`, `TabCompanyProfile`, `TabSystemPreferences`, `AuditLogWidget`, `BackupWidget`, `DeliveriesTable`, `LogisticsKPIs` (ver §5).
- **P5.** R: AppRoutes.tsx:17-56 declara 13 `lazy(() => import(...).then(m => ({ default: m.X })))`, y en el resto de `src/` no hay ningún otro `lazy(`. G conecta las **13** páginas con aristas `dynamic_import` e `imports_from` (`deferred`) hacia el **archivo** de cada página, así que **no hay ninguna huérfana**. A nivel símbolo, el JSX `<ClientsPage/>` apunta a la constante lazy local de AppRoutes, no a la función `ClientsPage()` del módulo: el `.then(m => m.ClientsPage)` no se resuelve.
- **P6.** `path "CreateOrderModal" "fetchProducts"` da `CreateOrderModal() --calls [EXTRACTED]--> fetchProducts()`, un salto. **Es real**: CreateOrderModal.tsx:37 declara el componente y en :50 está `(signal) => fetchProducts(empresaId ?? '', signal)`, dentro del callback que se le pasa a `useCachedQuery`. El grafo atribuye la llamada al componente que la contiene, lo cual es correcto.
- **P7.** G y R coinciden en 16 pares archivo:símbolo:
  - **`purchaseOrders.service`**: 14 pares en 7 archivos
    - ComprasPage y TabPendingReceipt usan `getPurchaseOrdersPage`, `exportPurchaseOrders`, `updatePurchaseOrderStatus` y `computePurchaseOrderTotal`
    - PurchaseOrderDetailPanel y PurchaseOrdersTable usan `computePurchaseOrderTotal`
    - PurchaseOrderFormModal usa `createPurchaseOrder`
    - TabPurchases usa `generatePurchaseOrderFromSuggestion`
    - SupplierDetailPanel usa `getPurchaseOrdersBySupplierId` y `computePurchaseOrderTotal`
  - **`dashboard.service`**: `useDashboard.ts` usa `fetchDashboardData`
  - **`session.service`**: `useSessionStore.ts` usa `fetchSession`

## 5. Falsos negativos y falsos positivos, con su causa

**Falsos negativos (solo P3, 6/6). Causa: acceso a propiedad.** El grafo no modela campos ni *member expressions*. `client.isActive` en un ternario JSX (ClientDirectoryTable.tsx:37), dentro de un accessor (ClientsPage.tsx:74), dentro de un `if` (orders.service.ts:316), en un argumento (CreateClientModal.tsx:92) o en un return (orderEligibility.ts:37): ninguno de esos usos genera arista. Tampoco existe un nodo `ClientAccount.isActive` del que puedan colgar.

**Falsos positivos:**

- **P2 (151). Causa: el grafo no conoce la visibilidad.** Ningún nodo tiene atributo `exported`, así que "sin aristas entrantes" mezcla tres cosas:
  - helpers privados de módulo, como `compareOrders` y `matchesFilters`
  - handlers anidados dentro de componentes, como `handleKeyDown`, `setPage` y `goToPage`
  - métodos de clase, como `ErrorBoundary.render` y `ApiError.constructor`

  Para el Gate 5 la lista sirve como superconjunto (no pierde ningún export huérfano), pero hay que filtrarla a mano o con grep: 87 % es ruido.
- **P4 (7). Causa: un import de CSS por efecto secundario se resuelve al TSX del mismo nombre.** `import '@/modules/settings/SettingsPage.css'` (TabCommercial.tsx:2, TabCompanyProfile.tsx:2, TabSystemPreferences.tsx:2, BackupWidget.tsx:2, AuditLogWidget.tsx:10) y `import '../LogisticsPage.css'` (DeliveriesTable.tsx:7, LogisticsKPIs.tsx:3) quedan como `imports_from` hacia `SettingsPage.tsx` y `LogisticsPage.tsx`. El `.css` no se indexa y el resolver cae en el archivo con el mismo basename. Resultado: una dependencia inversa falsa, porque el componente hijo parece depender de la página.
- **P3 (1).** `isActiveTab` coincide por nombre, pero es otro símbolo.

## 6. Verificación adversarial

### E1 — Precisión: **8/8**

Muestra con semilla fija (`20261009`). Hay 4 `calls`/EXTRACTED y 4 INFERRED. Las INFERRED son todas `indirect_call`, porque no existe ningún `calls` INFERRED.

| arista | línea real |
|---|---|
| `sortOrders() -calls-> compareOrders()` @ services/mock/purchaseOrders.service.ts:103 | `const cmp = compareOrders(a, b, sortField);` ✔ |
| `OrdersPage() -calls-> ErrorState()` @ OrdersPage.tsx:265 | `<ErrorState message="No se pudo cargar…" onRetry={refetch} />` ✔ (JSX) |
| `SupplierDetailPanel() -calls-> formatDate()` @ SupplierDetailPanel.tsx:183 | `{formatDate(p.lastUpdate)}` ✔ |
| `compareInvoices() -calls-> parseInvoiceDate()` @ subscription.service.ts:39 | `return parseInvoiceDate(a.fecha) - parseInvoiceDate(b.fecha);` ✔ |
| `cash.service.ts -indirect_call-> cashTransactionToDTO()` @ cash.service.ts:66 | `CASH_MOCK_DATA.transactions.map(cashTransactionToDTO)` ✔ |
| `Sidebar.tsx -indirect_call-> IconLogistics()` @ Sidebar.tsx:111 | `{ …, icon: IconLogistics }` ✔ (referencia como valor, no llamada) |
| `getTripsPage() -indirect_call-> withComputedFields()` @ trips.service.ts:166 | `.map(withComputedFields)` ✔ |
| `TabMovements() -indirect_call-> getMovementsPage()` @ TabMovements.tsx:88 | `usePagedQuery(getMovementsPage, filters, {` ✔ |

### E2 — Recall de imports: **8/8**

Son 8 archivos distintos: 2 `.tsx` con componentes usados en JSX, más un re-export que hace de barrel. **En `src/` no existe ningún `index.ts`**, así que se usó el equivalente: `OrderFormInput`, que `orders.service.ts:18` re-exporta (`export type { OrderFormInput }`) y CreateOrderModal importa desde ahí.

| archivo:línea | import | en el grafo |
|---|---|---|
| CreateOrderModal.tsx:13 | `type OrderFormInput` vía `orders.service` (re-export) | ✔ `imports` → **resuelto hasta `modules/orders/api/mapper.ts`** (la definición original) |
| OrdersPage.tsx:8 | `ErrorState` (JSX) | ✔ → shared/components/ui/ErrorState.tsx |
| ProductFormModal.tsx:5 | `Modal` (JSX) | ✔ → shared/components/ui/Modal.tsx |
| RegistrarEntregaModal.tsx:10 | `getOrderById` | ✔ → orders.service.ts |
| orders.service.ts:7 | `httpClient` | ✔ → shared/api/httpClient.ts |
| useDashboard.ts:2 | `fetchDashboardData` | ✔ → services/mock/dashboard.service.ts |
| dateRangePresets.ts:8 | `toLocalDateString as toISODateString` (alias) | ✔ → shared/utils/date.ts |
| InventoryPage.tsx:23 | `deleteProduct` | ✔ → products.service.ts |

### E3 — Repo intacto: ✔

Salida antes de escribir este reporte (después se repite con el reporte agregado; ver el informe del chat):

```
$ git status --porcelain
 M .gitignore
$ git diff --stat lean
 .gitignore | 3 +++
 1 file changed, 3 insertions(+)
$ git diff lean -- FrontEnd/src FrontEnd/package.json FrontEnd/package-lock.json CLAUDE.md FrontEnd/CLAUDE.md .claude | wc -c
0
$ git status --porcelain --ignored
 M .gitignore
!! FrontEnd/graphify-out/
```

Graphify no escribió nada fuera de `FrontEnd/graphify-out/`. `.gitignore` lo modifiqué yo (C6), porque `git check-ignore` daba exit 1.

### E4 — Entorno intacto: ✔

| check | línea base (A5) | final |
|---|---|---|
| `ls ~/.claude/skills` | `synced` | `synced` (no hay `graphify/`) |
| `grep -i graphify ~/.claude/settings.json` | nada | nada. md5 `19f582f4…` igual antes y después |
| `.git/hooks` sin `.sample` | nada | nada |
| `git config --get-regexp ^merge\.` | nada | nada |
| `~/.graphify` | no existe | no existe |

Ningún archivo de `~/.claude` modificado después de la línea base contiene la palabra "graphify". Los cambios que hay son la sincronización de marketplace, plugins y skills del propio Claude Code. `plugin-directory-cache-v2.json` sí menciona graphify (el catálogo de plugins), pero su fecha es 09:15:21, anterior a la instalación (09:20). `~/.copilot` ya existía (2026-08-24) y no tiene `skills/graphify`.

**Cambios en la máquina que sí hizo esta sesión**, fuera del repo y dentro de lo permitido: quedaron instalados la herramienta uv `graphifyy` y CPython 3.12.14 gestionado por uv. Se revierten con la §10.

### E5 — Reproducibilidad: ✔ idéntico

Borré `graphify-out/` y repetí los mismos dos comandos. Resultado: 1.668 nodos y 5.359 aristas las dos veces, 0 diferencias de ids de nodo, 0 de aristas y 0 de asignación de comunidad. **El md5 de graph.json es idéntico** (`8147bfd0b38f2af8789dc2bd7d5b7507`). Tiempo: extract 17,6 s más cluster-only 2,2 s.

## 7. Puntos ciegos en este stack (React 19 + TS)

| no captura / captura mal | ejemplo concreto de este repo |
|---|---|
| **Accesos a propiedades y campos** (lecturas y escrituras) | `client.isActive` en `ClientDirectoryTable.tsx:37`. Cualquier auditoría de "quién lee el campo X" (D1, migraciones a medias: dinero, IDs) **sigue yendo por grep** |
| **Visibilidad export / no export** | `compareOrders` (privado) y `sortAlertsByRecency` (export huérfano) se ven iguales |
| **Imports de CSS por efecto secundario** (resuelve al `.tsx` del mismo nombre) | `TabCommercial.tsx:2` `import '@/modules/settings/SettingsPage.css'` queda como dependencia de `SettingsPage.tsx` |
| **Lazy a nivel símbolo** (`.then(m => ({ default: m.X }))`) | AppRoutes.tsx:20-21. La ruta conecta con el archivo `ClientsPage.tsx`, no con la función `ClientsPage()` |
| **Granularidad de callbacks** | La llamada dentro de `(signal) => fetchProducts(...)` (CreateOrderModal.tsx:50) se atribuye al componente. Es correcto para el impacto, pero se pierde "dentro de qué hook" |
| **Nada fuera de `.ts`/`.tsx`** | Los `.css` no se indexan. Los `scripts/smoke/*.mjs` quedan fuera porque el corpus es solo `src/` |
| **Ruido de consulta** | `query "<pregunta>"` hace BFS de profundidad 2 y trunca por presupuesto (70 nodos para P1). Lo útil es `explain`, `affected --relation calls --depth 1` y `path` |
| **Dirección** | `graph.json` declara `"directed": false`, pero las aristas conservan `source → target`, y `path`/`affected` respetan la dirección por defecto. Hay que tenerlo presente si se escriben scripts |

Lo que **sí** captura bien: imports (incluido el alias `as` y el re-export resuelto hasta la definición original), llamadas directas, JSX como `calls`, funciones pasadas como valor (`indirect_call`: `usePagedQuery(getMovementsPage, …)`, `.map(withComputedFields)`) e `import()` dinámico a nivel archivo.

## 8. Veredicto

Umbrales fijados de antemano, sin ajustar:

- **ADOPTAR PARA AUDITORÍAS**: recall ≥ 90 % en P1, P2 y P4 **y** Bytes G ≤ 50 % de Bytes R en al menos 4 de las 7 preguntas.
  - Recall: P1 100 %, P2 100 %, P4 100 % → **cumple**.
  - Bytes: solo P6 → **1/7, no cumple** (3/7 incluso en el escenario más favorable de §4).
- **NO ADOPTAR**: recall < 70 % en P1 o P2. **No aplica** (100 % / 100 %).
- **USO LIMITADO (solo mapa visual)**: cualquier otro caso.

### **VEREDICTO: USO LIMITADO (solo mapa visual).**

Hay que leer bien lo que dicen los números: en call-sites e imports no se le escapó nada en este repo, así que no es *peligroso* para el Gate 5. Pero tampoco ahorra contexto frente a grep bien dirigido, mete ruido (P2, P4) y es ciego a los accesos a campos (P3).

## 9. Propuesta para PROTOCOLO.md

No aplica: el veredicto no es ADOPTAR.

## 10. Desinstalación completa

En Git Bash o PowerShell:

```
uv tool uninstall graphifyy
uv python uninstall 3.12
```

`3.12` solo si no lo querés para otra cosa. Lo instaló esta sesión; antes solo estaba 3.14.7.

El clone descartable (contiene `graphify-out/`, rama y tags locales):

```
Remove-Item -Recurse -Force C:\proyectos\SDGPD-graphify
```

En el repo hay que decidir qué hacer con la línea de `.gitignore`:

- Si se quiere sacar: `git revert -m 1 <hash del merge>` (ver el informe del chat) o borrar a mano las 2 líneas `graphify-out/` del `.gitignore` raíz.
- Si se quiere dejar: es inocua.

Para borrar del remoto la rama y los tags del piloto (opcional):

```
git push origin --delete sesion-piloto-graphify-2026-10-09
git push origin --delete pre-sesion-piloto-graphify-2026-10-09 post-sesion-piloto-graphify-2026-10-09
```

No hay nada que deshacer en `~/.claude`, `.git/hooks` ni `git config`: Graphify no tocó nada de eso (E4).

## 11. Decisiones tomadas sin consultar

1. **`--timing` no existe** en 0.9.82: `extract --help` solo remite a `graphify --help`, donde no aparece. Medí con `time`.
2. **`--out .`** en `extract`. Por defecto la salida va a `<path>/graphify-out`, que sería `FrontEnd/src/graphify-out`, dentro de `src/`. Con `--out .` queda en `FrontEnd/graphify-out/`.
3. **`cluster-only . --no-label`** para generar `graph.html` y `GRAPH_REPORT.md`, porque `extract` no los genera. Antes de correrlo leí el código (`graphify/llm.py:3551`): sin `--no-label`, el nombrado de comunidades **usa en silencio el backend `claude-cli` si encuentra `claude` en el PATH**, y en esta máquina lo encuentra (`C:\Users\leand\.local\bin\claude.exe`). Con `--no-label` ese camino no se ejecuta. `extract` no nombra comunidades (cli.py:4870-4876).
4. **Python 3.12 en vez del 3.14 por defecto de uv**, e **invocación como `python -I -m graphify`** en vez de `graphify.exe`. Las dos cosas se deben al Control de aplicaciones de Windows (§2). Fue el intento 2 de 3, siempre con uv y con el paquete `graphifyy`.
5. **No hay `index.ts` en `src/`**, así que el caso "barrel" de E2 se cubrió con un re-export real (`orders.service.ts:18`).
6. **P2-G: el grafo no marca exports.** Usé "callable no-clase en `shared/**` o `modules/*/api/**` sin aristas entrantes `calls`/`imports*`/`references`/`indirect_call`/`re_exports`/`dynamic_import` desde otro archivo".
7. **P3**: "cliente" se interpretó como `ClientAccount` (`shared/types/client.types.ts:90`). `mapper.ts:132` (`input.isActive`, otro tipo) quedó fuera de R.
8. **P4**: la cadena de rutas (`AppRoutes`, `App`, `main`) cuenta como dependiente transitivo en G y en R.
9. **P1**: `getPurchaseSuggestionsPage` (dato viejo del prompt) se reemplazó por el llamador actual, `getActiveProductIds`.
10. **E1**: no existen aristas `calls` INFERRED, así que las 4 INFERRED son `indirect_call`.
11. Regeneré `FrontEnd-callflow.html` después de E5, porque el borrado de `graphify-out/` lo había eliminado.

## 12. Desvíos autorizados

- **Clone descartable** `C:\proyectos\SDGPD-graphify` (`git clone --branch lean`) en vez de `C:\proyectos\SDGPD`. Ese repo tiene BE-0b en curso: 8 archivos modificados y 1 sin trackear en `sesion-be0b-2026-10-08`. No toqué nada de BE-0b ni del clone de OneDrive.
- **`ESTADO.md` sin tocar** (F2 cancelado), porque la sesión de BE-0b lo va a reescribir. El gate E3 se evalúa contra 2 archivos: `.gitignore` y este reporte.
- **Rama huérfana en el clone de OneDrive**, solo lectura:

  ```
  $ git -C "C:\Users\leand\OneDrive\Desktop\Innov\App\SDGPD" reflog show --date=iso sesion-piloto-graphify-2026-10-09
  443a985 sesion-piloto-graphify-2026-10-09@{2026-10-09 09:16:33 -0300}: branch: Created from HEAD
  $ git -C ... reflog show --date=iso HEAD | head -1
  443a985 HEAD@{2026-10-09 09:16:33 -0300}: checkout: moving from lean to sesion-piloto-graphify-2026-10-09
  ```

  Se creó el **2026-10-09 a las 09:16:33** con un `git switch -c` / `checkout -b` desde el `lean` local de ese clone (`443a985`, que está atrás de `origin/lean` = `4d5ded2`). Fue antes de que arrancara esta conversación: ya aparecía en el `git status` inicial. Es consistente con un A4 del prompt original ejecutado a medias, con la rama creada y el tag `pre-…` sin crear. El reflog no dice qué proceso o sesión lo hizo. No la borré ni cambié de rama ahí.

## 13. Checklist para Leandro en el navegador

Abrí `C:\proyectos\SDGPD-graphify\FrontEnd\graphify-out\graph.html` (hace falta internet para vis-network). Usá el buscador del grafo:

1. **`fetchProducts`**: debería verse un nodo con grado 14. Tiene aristas entrantes `calls` desde `ComprasPage`, `InventoryPage`, `CreateOrderModal`, `createOrder`, `getActiveProductIds` y `hasInactiveProduct`, y una saliente `indirect_call` a `productFromDTO`. Si falta alguno de esos 6, el HTML no refleja el JSON.
2. **`usePagedQuery`**: debería verse un hub con 19 llamadores directos (las páginas y Tabs de §4 P4 más `useLiveQuery`). Buscá también `SettingsPage` y comprobá que **se ve el falso positivo**: `TabCommercial` y `BackupWidget` pegados a `SettingsPage.tsx` (es el import del `.css`). Sirve para calibrar cuánto creerle al mapa.
3. **`AppRoutes`**: deberían verse 13 aristas hacia los archivos `*Page.tsx` (dynamic_import), más `AppShell` y `ErrorBoundary`. `AnalyticsPage` y `DashboardPage` tienen que estar conectadas aunque no usen `usePagedQuery`.

Opcional: `FrontEnd-callflow.html` en la misma carpeta (diagramas Mermaid por sección).
