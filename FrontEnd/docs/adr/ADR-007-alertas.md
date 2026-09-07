# ADR-007 — Alcance y ciclo de vida de las alertas

**Estado:** Decidido. **Fecha:** 2026-09-07.

## Problema

Tanda 7 (Tablero) necesita un badge de alertas (contador) y un detalle navegable, sin repetir el anti-patrón ya señalado en A3/A8: traer todas las alertas al cliente para contarlas o para saber si hay alguna sin leer.

## Opción elegida

- **Dos endpoints, nunca uno solo:**
  - `GET /alerts/summary` → contadores por tipo y severidad. Es lo único que el badge del layout necesita — nunca pide el detalle completo solo para saber "cuántas hay".
  - `GET /alerts?cursor=&tipo=&severidad=` → detalle paginado **por cursor** (no offset — ver la Sección 5 del prompt maestro, "cursor por defecto"; distinto de los 13 listados existentes que usan offset por razones históricas ya documentadas en `AUDIT_3_PAGINACION_VOLUMEN.md` hallazgo #3 — las alertas son una consulta nueva, sin ese lastre, así que arrancan con el patrón correcto desde el día uno).
- **Estado leído/no leído por usuario**, marcado explícito (una acción del usuario, "marcar como leída" — no un `useEffect` que la marque sola al montar el componente, ver Sección 7 del prompt maestro: "nada de derivar datos del servidor con `useEffect` + `setState`").
- **Sin borrado desde la UI** — una alerta se marca leída, nunca se elimina desde el cliente (el historial de alertas queda íntegro; la política de retención/limpieza, si existe, es responsabilidad del backend real).
- **Tipos iniciales:** transferencias retrasadas y productos por vencer, modelados como **unión discriminada extensible** (`type Alert = { tipo: 'transferencia-retrasada'; ... } | { tipo: 'producto-por-vencer'; ... }`) — agregar un tipo nuevo en el futuro es agregar un miembro a la unión, no reestructurar el tipo existente.

## Alternativas descartadas

1. **Un solo endpoint que devuelve todas las alertas, y el cliente cuenta/pagina en memoria.** Descartada explícitamente — es el mismo anti-patrón que A3 ya identificó como ALTO en Reposición (traer la colección completa para operar sobre ella en el cliente); las alertas, por naturaleza, pueden crecer sin límite (cada producto por vencer es una alerta potencial) y el prompt maestro lo prohíbe en la Sección 7 ("ningún agregado se calcula en el cliente").
2. **Paginación por offset para el detalle**, igual que el resto de los listados del proyecto. Descartada para este caso puntual: las alertas son una consulta nueva sin la razón histórica que llevó a offset en los 13 listados existentes (UI de números de página ya construida) — es la oportunidad de empezar con cursor, que además calza mejor con un feed que crece "hacia adelante" (nuevas alertas) en vez de un catálogo estable.
3. **Borrado de alertas desde la UI.** Descartada porque una alerta borrada es una pérdida de historial (¿hubo o no hubo una transferencia retrasada tal día?) — el criterio "sin borrado, solo marcado" preserva la auditoría, consistente con el principio append-only ya aplicado en ADR-001/002.
4. **Un tipo de alerta como string libre** (`tipo: string`) en vez de unión discriminada. Descartada por el mismo criterio que ADR-006 aplica a los IDs — un string libre no da ninguna garantía de que el consumidor maneje todos los casos posibles; una unión discriminada obliga (con un `switch` exhaustivo) a que agregar un tipo nuevo señale en tiempo de compilación cada lugar que todavía no lo contempla.

## Qué se rompe si se cambia después

- Si el badge del layout deja de usar `/alerts/summary` y empieza a inferir el conteo del detalle paginado (ej. sumando `total` de una consulta filtrada), se reintroduce el riesgo de que un dato "rápido de mostrar siempre" (el badge, visible en cada pantalla) dependa de una consulta pensada para otro caso de uso (el detalle, paginado, más pesada).
- Si se migra el detalle de cursor a offset después de haber compartido código con otros listados, hay que auditar qué asume "número de página" en vez de "cursor opaco" — mejor no hacerlo salvo necesidad real.
- Si se permite borrado desde la UI más adelante, hay que decidir qué pasa con el historial ya acumulado sin esa capacidad (migración de datos, no solo de código).
