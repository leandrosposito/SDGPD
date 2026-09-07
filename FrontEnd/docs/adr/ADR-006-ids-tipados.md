# ADR-006 — IDs tipados (branded types)

**Estado:** Decidido. **Fecha:** 2026-09-07.

## Problema

`AUDIT_4_IDS_RELACIONES.md` (hallazgo #2, MEDIO) confirmó que todos los IDs del dominio son `string` plano — TypeScript no distingue `OrderId` de `BranchId` en la misma firma de función. El ejemplo concreto ya documentado: `getStockForBranch(empresaId, productId, branchId)` compila igual si se invierten `productId`/`branchId`, y falla recién en runtime. Tanda 5 necesita `OrderId` real para la relación pedido↔cliente (ADR-001 la necesita también, para `OrderLineId`).

## Opción elegida

- **Branded types por dominio:** `type OrderId = string & { readonly __brand: 'OrderId' }`, y equivalentes para `ClientId`, `ProductId`, `BranchId`, `DeliveryId`, `OrderLineId`. TypeScript los trata como tipos distintos entre sí (no intercambiables) aunque en runtime sigan siendo `string`.
- **Un único constructor por tipo:** `asOrderId(raw: string): OrderId` (y equivalentes) que valida el formato y **falla explícito** (lanza o devuelve un resultado de error tipado — a definir en la implementación, pero nunca en silencio devolviendo el string sin validar) si el formato no es el esperado.
- **Parseo desde params de URL SIEMPRE a través de ese constructor** — nunca un `as OrderId` directo sobre un `string` leído de `useParams`/`useSearchParams` sin pasar por el validador.
- **Migración incremental:** primero `OrderId` y `BranchId` (los que necesitan las Tandas 4 y 5), el resto (`ClientId`, `ProductId`, `DeliveryId`, `OrderLineId`) se migra cuando la tanda que los necesita llega (Tanda 8 para `DeliveryId`/`OrderLineId`, la relación pedido↔cliente de Tanda 5 para `ClientId`).

## Alternativas descartadas

1. **Migrar los 6 tipos de una sola vez.** Descartada por la regla de "cambios pequeños y reversibles" del prompt maestro — branded types tocan potencialmente cada firma de función que recibe ese id, y hacerlo de una sola vez para 6 dominios a la vez es un cambio grande y difícil de revisar. La migración incremental (empezar por los 2 que las Tandas 4/5 necesitan) acota el blast radius por tanda.
2. **`unique symbol` en vez de intersección con un campo `__brand`.** Descartada por ser más compleja de usar en la práctica (requiere un símbolo real en runtime en algunos patrones) sin ganar nada relevante para este caso — la intersección con un campo fantasma (`__brand`) es el patrón más simple y más común en TypeScript para branded types, sin costo en runtime (el campo nunca existe de verdad, es solo type-level).
3. **Validación silenciosa (devolver `undefined` o el string sin validar si el formato no matchea).** Descartada explícitamente — el prompt maestro pide "falla explícito, nunca en silencio": un ID mal formado que se acepta silenciosamente reintroduce exactamente el problema de runtime que este ADR busca prevenir, solo que más tarde y más difícil de rastrear.

## Qué se rompe si se cambia después

- Si se agrega un id nuevo sin pasar por `as<Tipo>Id`, se reintroduce el problema (TypeScript vería un `string` plano donde el resto del código espera el branded type, y el compilador lo señalaría — pero solo si el desarrollador no usa `as` para forzarlo, que está prohibido por las reglas de operación del prompt maestro).
- Si se decide migrar los 4 tipos restantes antes de que las tandas que los necesitan lleguen, no hay costo de reversión real (es trabajo adelantado, no una decisión que rompa algo) — pero sí un costo de alcance si esa tanda no estaba planeada para tocar esos archivos.
- Si el constructor deja de fallar explícito y empieza a aceptar cualquier string, se pierde la garantía que todo el resto del ADR (y ADR-001, que depende de `OrderLineId`) asume — cualquier parseo de URL o de un formulario que dependa de la validación teórica dejaría de estar protegido en la práctica.
