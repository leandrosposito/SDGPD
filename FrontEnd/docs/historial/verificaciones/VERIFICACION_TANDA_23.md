# Verificación Tanda 23 — Restos de la Tanda 22 + dinero (ADR-008, enmienda 2026-10-09)

**Fecha:** 2026-10-09. Rama `sesion-dinero-fechas-2026-10-09`.

## Qué cambió

- **23.1:** se borró el re-export `export { toISODateString }` de `dateRangePresets.ts`. El import interno se conserva.
- **23.2: NO HECHO.** El fix del centinela `'' as Trip['id']` (`TripDetailPanel.tsx:119`) obliga a cambiar la firma de `getTripPosition` (`TripPositionQueryFilters.tripId`). La extensión de la regla de ESLint quedó probada (marca exactamente esa línea) y revertida. Ver PENDIENTES #23.
- **23.3, `shared/utils/money.ts`:**
  - `money()` redondea de forma simétrica: la mitad exacta se aleja del cero.
  - `Money` admite negativos.
  - `moneyFromNumber` desplaza la coma en base 10 (antes `value * 100`) y lanza si el valor no es finito.
  - `parseMoneyInput` valida el string y delega en `moneyFromNumber`.
- **23.4:** PENDIENTES #21 (sin la nota de `moneyFromNumber`), #22 (respuestas de `httpClient` sin validar) y #23 (el centinela).
- **Docs:** ADR-008 (enmienda 2026-10-09) y DECISIONES_TECNICAS.

## Gates

| Gate | Resultado |
|---|---|
| 1 `tsc -b --noEmit` | exit 0 |
| 2 `eslint .` | 0 errores, 1 warning preexistente |
| 3 `vite build` | exit 0 |
| 4 smoke | `tanda-7.smoke.mjs`: 40 OK (eran 30). Contra el `money.ts` anterior, 7 de los casos nuevos dan FAIL. Los 27 scripts sin FAIL |
| 5 conexión | no hay exports nuevos. `moneyFromNumber` sigue con su consumidor (`dashboardAggregates.service.ts:106`) |
| 6 autorrevisión | sin `any`/`as`/`@ts-ignore` nuevos |
| 8 arquitectura | sin cambios de estructura |

**Impacto en el tablero (23.3f):** el script descartable llama a `getOverdueTotalsInMoney` real contra el mock. Antes y después da lo mismo, ARS 160.800.000 centavos (origen 1.608.000) y USD 100.000 centavos (origen 1.000), con un diff vacío.

## Qué verificar en el navegador

1. **Tablero:** la tarjeta de deuda vencida por moneda se ve igual que antes (ARS $1.608.000,00, USD 1.000,00).
2. **Viajes:** abrir el detalle de un viaje. Abre y carga (paradas, POD). Si hay un viaje "En tránsito", la posición se actualiza.
3. **Viajes sin viaje seleccionado:** con el panel cerrado, o justo después de cerrarlo, no hay error en consola. En la pestaña Network (o en el log de `VITE_API_DEBUG`) **no** aparece ninguna consulta de posición con `tripId` vacío. El centinela sigue en el código (23.2 no se hizo); esto confirma que sigue inofensivo.

## Qué NO se verificó

- Nada en el navegador.
