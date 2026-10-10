# REPORTE 2026-10-10 — Ciclo de imports pedidos ↔ entregas (solo docs)

> Verificado contra el filesystem el **2026-10-10**, sobre `lean` en `e719e96`. Si leés esto después, reverificá.

Sesión chica, solo de documentación. **No toca código.** Rama `sesion-ciclo-pedidos-entregas-2026-10-10`, tag `pre-sesion-ciclo-pedidos-entregas-2026-10-10`.

## Qué hice

**Hecha.** Corregí una afirmación falsa de `ARQUITECTURA.md` y registré la deuda en `PENDIENTES.md` (#25).

**Origen.** Un análisis de capas sobre el grafo de Graphify de `FrontEnd/src` (regenerado sobre `e719e96`; ver `REPORTE_2026-10-09_piloto-graphify.md`) mostró aristas en los dos sentidos entre `orders.service.ts` y `deliveries.service.ts`. Lo confirmé con grep:

- `deliveries.service.ts:13` importa `applyDeliveryToOrderLines` y `getOrderById` de `orders.service.ts`.
- `orders.service.ts:12` importa `getActiveDeliveriesForOrder` de `deliveries.service.ts`. Lo usa `cancelOrder` (`:461`). Entró con `5167db8` (2026-09-09).

`ARQUITECTURA.md:52` afirmaba "sigue siendo de un solo sentido — no hay ciclo". El código ya documentaba la desviación como deliberada en `deliveries.service.ts:91-99`. El documento de arquitectura quedó viejo.

**Hallazgo lateral sobre Graphify.** La sección "Import Cycles" de su `GRAPH_REPORT.md` salió vacía. La herramienta no detecta este ciclo sola; apareció solo cruzando las aristas a mano.

## Commits creados

- `docs: ciclo de imports pedidos ↔ entregas — corregir ARQUITECTURA.md y registrar PENDIENTES #25` (hash en `git log`).
- Se mergea a `lean` con `--no-ff` solo si Leandro lo aprueba.

## Decisiones que tomé sin consultar

1. **No refactorizar el ciclo.** Hoy es seguro: los dos lados usan el import solo dentro del cuerpo de una función. Lo verifiqué con grep: fuera de las funciones, los símbolos solo aparecen en sus propias definiciones. Desaparece cuando pedidos y entregas pasen al backend (BE-5/BE-6).
2. **`ESTADO.md` sin tocar.** BE-2 está a medias en otra rama y va a reescribir ese archivo en su cierre. Tocarlo acá le genera un conflicto de merge por una sola línea. La deuda queda registrada en `PENDIENTES.md`, que es el inventario de deuda viva.
3. **Worktree en el scratchpad** en vez de `C:\proyectos\SDGPD`, porque esa carpeta tiene BE-2 en curso. Antes, `lean` local se puso al día con `origin/lean` por fast-forward (`4d5ded2` → `e719e96`).
4. **Señalé una posible diferencia de regla para BE-5.** El frontend bloquea cancelar si hay entregas activas, mientras que ADR-BE-009 contempla cancelar con entregas despachadas liberando solo la reserva del pendiente. No lo resolví: es una pregunta para BE-5.

## Hallazgos de la Fase D

No aplica (no hay código). Verificación de los docs:

- Las líneas y los hashes citados se comprobaron con `grep`/`git log -S` sobre `e719e96`.
- El diff no introduce cambios de finales de línea fuera de las líneas editadas.

## Hallazgos MEDIO/BAJO documentados y no tocados

- PENDIENTES #25 (Baja).
- `orders.service.ts:11` importa un tipo de `modules/dashboard/api/dashboardAggregates.ts` (`OrderProjectionForAggregation`). La dependencia va al revés de lo esperable, pero es solo de tipo y se borra al compilar. No se registra como ítem.

## Riesgos introducidos

Ninguno: solo cambian dos documentos.

## Qué NO verifiqué

No corrí gates de código, porque no se tocó código.

## Qué tiene que probar Leandro a mano

Nada funcional. Leer PENDIENTES #25 y confirmar la decisión de no refactorizar.

## Cómo revertir

`git revert -m 1 <hash del merge de sesion-ciclo-pedidos-entregas-2026-10-10>`. El merge queda marcado con el tag `post-sesion-ciclo-pedidos-entregas-2026-10-10`.
