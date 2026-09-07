# AUDIT 6 — Estado global (Zustand) y persistencia

## Alcance revisado (archivos/carpetas)

`src/shared/state/useSessionStore.ts`, `src/shared/state/resettableStores.ts`, `src/modules/inventory/state/useReplenishmentStore.ts` (los 2 únicos stores de Zustand del proyecto, confirmado por `grep -rn "= create<" src` → exactamente 2 resultados), todo call-site de `useSessionStore(`/`useReplenishmentStore(` en `src/modules/**` y `src/shared/**`, y todo uso de `localStorage`/`sessionStorage` en `src/` (`grep -rn "localStorage\.|sessionStorage\." src` → 5 resultados, 3 archivos). Solo lectura.

## Hallazgos

| # | Severidad | Archivo:línea | Descripción | Impacto con volumen | Propuesta |
|---|---|---|---|---|---|
| 1 | BAJO | `src/shared/state/resettableStores.ts` (todo el archivo) | El registro de stores/efectos a resetear al cambiar de sucursal depende 100% de disciplina manual: un store de Zustand nuevo que no llame a `registerResettableStore(...)` en su propio archivo simplemente no se resetea, y no hay ningún lint, tipo o test que lo detecte. Hoy no aplica en la práctica: de los 2 stores reales, `useSessionStore` no debe registrarse (es el disparador, no un consumidor) y `useReplenishmentStore` SÍ está registrado (`useReplenishmentStore.ts:58`) — 0 stores hoy incumplen la convención. | El riesgo crece linealmente con la cantidad de stores de módulo que se agreguen en tandas futuras (Tanda 8 — entregas — probablemente necesite estado de UI propio). Un desarrollador que copie un store existente como plantilla pero se olvide la línea de registro introduce un bug de aislamiento sucursal silencioso, indistinguible en el diff de uno que sí la tiene. | Podría mitigarse con una función factory (`createResettableStore(initializer)`) que registre automáticamente en el momento de `create(...)`, en vez de requerir una segunda línea aparte — elimina la posibilidad de olvidarla. No implementar ahora (fuera de alcance de Fase A), pero dejarlo como candidato de ADR o de la primera tanda que agregue un store nuevo. |
| 2 | BAJO | `src/shared/state/useSessionStore.ts:40-47` (interfaz `SessionState`) | `session` (dato de servidor, cargado una vez vía `fetchSession()`) y `activeBranchId` (elección de UI, persistida en `localStorage`) conviven en el mismo store y la misma interfaz — mismo hallazgo ya registrado en `docs/PENDIENTES.md` (ítem 6) y `docs/RELEVAMIENTO_CACHE.md` (E3), sigue vigente sin cambios. No es un problema de aislamiento (ambos campos se resetean/no se resetean de forma correcta hoy) sino de separación de responsabilidades: el resto del proyecto sí distingue con cuidado "TanStack Query para estado de servidor" vs. "Zustand para estado de UI", y este store es la única excepción. | Ninguno crítico a escala — `session` es un singleton idempotente (`loadSession` no repite fetch, `useSessionStore.ts:71-73`), no una colección que crezca. El costo es de mantenibilidad, no de performance ni de aislamiento. | Ya identificado en `PENDIENTES.md` como deuda de bajo riesgo — no requiere una propuesta nueva acá. |

**Ningún hallazgo de severidad ALTO o BLOQUEANTE en esta auditoría.** Ver detalle de por qué en la sección siguiente.

## Qué está bien (para no romperlo después)

- **Solo 2 stores de Zustand en todo el proyecto**, superficie mínima para razonar sobre aislamiento: `useSessionStore` (sesión + sucursal activa) y `useReplenishmentStore` (estado de UI puramente en memoria, `statusByProductId`, sin persistencia — comentario explícito en el propio código: `useReplenishmentStore.ts:35`, "Nada solicitado al arrancar; es estado de sesión, no viene del mock").
- **Ningún dato de NEGOCIO se persiste en `localStorage`/`sessionStorage`.** Los únicos 2 valores persistidos en todo `src/` son: `sdgpd.activeBranchId` (`useSessionStore.ts:24,54,99`) — un ID de sucursal, no un dato de negocio en sí, y el propio código lo trata como "conveniencia de UX, no autorización" (comentario `useSessionStore.ts:49-52`) — y `app-theme` (`Header.tsx:57,62,74`) — preferencia visual pura (claro/oscuro). Ningún catálogo, listado, cifra ni objeto de dominio (cliente, pedido, stock, caja) se guarda en almacenamiento persistente del navegador.
- **`activeBranchId` persistido no es una superficie de escalamiento real**: al rehidratarse (`resolveInitialBranchId`, `useSessionStore.ts:53-60`) se valida contra `session.branches` (que sí viene de la sesión recién cargada) y contra `status === 'active'` — un valor manipulado en devtools que no corresponda a una sucursal real de la sesión actual cae al `defaultBranchId`, no se usa tal cual.
- **No existe ningún flujo de logout en el proyecto** (confirmado: 0 resultados de `logout`/`signOut`/`cerrarSesion` en todo `src/`, sin case-sensitivity). Esto significa que el escenario "dato de negocio sobrevive a un logout" no aplica hoy porque no hay logout que ejecutar — no es una vulnerabilidad activa, es una funcionalidad que todavía no existe (ver Preguntas abiertas, es relevante para cuando se implemente autenticación real).
- **Ningún selector de Zustand se suscribe al store completo.** Revisados los 32 call-sites de `useSessionStore(`/`useReplenishmentStore(` en todo `src/modules` y `src/shared` (listado completo abajo) — el 100% usa la forma `(s) => s.algoEspecífico` (un primitivo o una acción), nunca `useXStore()` sin selector ni `useXStore((s) => s)`. Ningún selector construye un valor nuevo (`?? []`, spread, `.map`/`.filter`) dentro del propio selector — la regla Z2 documentada en `docs/DECISIONES_TECNICAS.md` sigue cumplida en el 100% de los call-sites actuales.

Call-sites verificados (archivo:línea → selector):
```
BranchSelector.tsx:16-19        → session, activeBranchId, isLoading, setActiveBranch
AppShell.tsx:19                 → loadSession
ComprasPage.tsx:72-73           → activeBranchId, session
ClientsPage.tsx:51              → session?.company.id (dentro del selector, ver nota abajo)
CashPage.tsx:37                 → session?.company.id
useCachedQuery.ts:106           → session?.company.id
usePagedQuery.ts:122            → session?.company.id
LogisticsPage.tsx:45-46         → activeBranchId, session
InventoryPage.tsx:74-75         → session, activeBranchId
SupplierDetailPanel.tsx:78      → session
AuditLogWidget.tsx:23           → session?.company.id
TabUsersRoles.tsx:48            → session?.company.id
TabSubscription.tsx:26          → session?.company.id
SuppliersPage.tsx:48            → session
StockAdjustmentModal.tsx:25-26  → activeBranchId, session?.company.id
TabStockCurrent.tsx:64          → session?.company.id
TabLowStock.tsx:65-67           → session?.company.id, statusByProductId, requestReplenishment
TabPurchases.tsx:41             → session?.company.id
TabProductHistory.tsx:49        → session?.company.id
TabMovements.tsx:46             → session?.company.id
OrdersPage.tsx:68                → session?.company.id
CreateOrderModal.tsx:31          → session?.company.id
OrderProductsSection.tsx:44-45   → activeBranchId, session?.company.id
```

**Nota sobre `(s) => s.session?.company.id`:** esto NO viola la regla Z2 (la regla prohíbe construir un valor NUEVO en cada llamada — array/objeto/resultado de `.map`/`.filter`/`?? []`/`?? {}` — no el optional chaining sobre un primitivo). `session?.company.id` devuelve un `string | undefined`, un primitivo, con la misma referencia semántica en cada llamada mientras `session` no cambie — no dispara loops de `useSyncExternalStore`. Es distinto del patrón que sí se corrigió en `[02/09/2026]` (`docs/DECISIONES_TECNICAS.md:648-707`), que era `?? EMPTY_ARRAY` (construye un array nuevo cada vez que la parte izquierda es null/undefined). Confirmado también por el propio `npm run lint` de la línea base (AUDIT_1): 0 errores, incluida la regla `no-restricted-syntax` que ya cubre este patrón por AST.

## Preguntas abiertas para Leandro

1. **No existe ningún flujo de autenticación/logout real todavía** (ver arriba) — cuando se implemente, ¿qué de lo persistido hoy (`sdgpd.activeBranchId`) debería limpiarse al cerrar sesión, y qué debería sobrevivir (ej. `app-theme`, preferencia de UI pura, probablemente sí debería sobrevivir a un logout)? No es urgente resolverlo ahora (no hay login/logout que implementar en esta fase), pero conviene que quede como criterio explícito antes de construir esa función, no decidido ad-hoc en el momento.
2. **¿Vale la pena separar `session` (servidor) de `activeBranchId` (UI) en dos stores/mecanismos distintos** (hallazgo #2, ya en `PENDIENTES.md`) **como parte de la Tanda 4 (selector de sucursal/depósito)**, dado que esa tanda ya va a tocar este store de todas formas, o se prefiere mantenerlo así y tratarlo como deuda aparte para no ensanchar el alcance de esa tanda?
