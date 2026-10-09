# Verificación Tanda 25 — Cierre de PENDIENTES #23 y gate intermitente de v13

**Fecha:** 2026-10-09. Rama `sesion-centinela-trip-2026-10-09`.

## Qué cambió

- **`TripDetailPanel.tsx`:** la consulta de posición (`useLiveQuery(getTripPosition, …)`) y el bloque "Posición actual (sin mapa)" pasaron al subcomponente `TripLivePosition` (mismo archivo, no exportado), que recibe `tripId: TripId` obligatorio.
  - El panel lo monta solo con `isOpen && localTrip.estado === 'EnTransito'`, la misma condición que antes era el `enabled` de la consulta.
  - Se eliminó el centinela `'' as Trip['id']`.
  - La query key y el intervalo (12 s) son idénticos.
  - `getTripPosition` y `TripPositionQueryFilters` no cambiaron.
- **ESLint:** `no-restricted-syntax` marca también el cast por tipo indexado a un id (`x as Trip['id']`, clave `id` o terminada en `Id`, directo y en unión). ADR-006 (enmienda 2026-10-09) lo nombra.
- **`scripts/verificacion/v13-tanda11-integrity.mjs`:** los dos `process.exit(n)` finales pasan a `process.exitCode = n`. Es una excepción explícita a la regla 2.5, autorizada por Leandro.
- **PENDIENTES:** #23 cerrado; #24 nuevo (rango de preset memoizado entre días).

## Gates

| Gate | Resultado |
|---|---|
| 1 `tsc -b --noEmit` | exit 0 |
| 2 `eslint .` | 0 errores, 1 warning preexistente. Antes del fix, la regla extendida marcaba solo `TripDetailPanel.tsx:119:113` |
| 3 `vite build` | exit 0 |
| 4 smoke / verificación | sin lógica pura nueva. `v13` dio 20/20 exit 0 en corridas seguidas |
| 5 conexión | `TripLivePosition` tiene call-site en `TripDetailPanel.tsx:241`. Sin huérfanos nuevos |
| 6 autorrevisión | se elimina un `as Trip['id']` y no se agrega ningún cast |
| 8 arquitectura | sin cambios de estructura: el subcomponente vive en el mismo archivo |

## Qué verificar en el navegador

Con la pestaña **Network** de las DevTools abierta. Las consultas de posición son `GET …/trips/<id>/position` en modo `http`. En modo mock no hay request de red: hay que mirar el log de `VITE_API_DEBUG` o la consola.

1. **Detalle de un viaje "En tránsito":** se ve el bloque "Posición actual (sin mapa)" con lat/lng y hora, y se actualiza cada **12 segundos**, igual que antes.
2. **Detalle de un viaje en otro estado** (Planificado, Despachado, Rendido, Cancelado): **no** aparece el bloque de posición y **no** hay requests de posición.
3. **Abrir y cerrar el panel varias veces** (con un viaje En tránsito): con el panel cerrado no quedan requests de posición corriendo. Esperar más de 12 s con el panel cerrado y confirmar que no aparece ninguno.
4. **Marcar en tránsito** un viaje Despachado desde el panel abierto: después del refetch del detalle aparece el bloque de posición y empieza a actualizarse.

## Qué NO se verificó

- Nada en el navegador.
- La rama de error de `v13` (`process.exitCode = 1` cuando hay fallas): no tengo un dato roto para provocarla sin tocar mocks. La semántica de `exitCode` es la misma que la de `exit()` para el código final.
