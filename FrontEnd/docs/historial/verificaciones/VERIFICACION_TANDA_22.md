# Verificación Tanda 22 — Gate 5: 3 exports conectados, 1 borrado y la regla escrita

**Fecha:** 2026-10-09. Rama `sesion-gate5-huerfanos-2026-10-09`. Parte de la reverificación de los 23 exports huérfanos del P2 del piloto de Graphify (`REPORTE_2026-10-09_piloto-graphify.md`), con las decisiones cerradas por Leandro.

## Qué cambió

- **ESLint** (`FrontEnd/eslint.config.js`): `no-restricted-syntax` prohíbe `x as <Tipo>Id` y `x as <Tipo>Id | undefined` fuera de `src/shared/types/ids.types.ts` (ADR-006, enmienda 2026-10-09). La regla pasa a severidad `error` para las dos familias de selectores: zustand (ya existía, en `warn`) e IDs. Flat config no fusiona las opciones de una misma regla entre bloques.
- **`TripsPage.tsx`**: los filtros `vehicleId`/`driverId` de la URL pasan por `safeVehicleId`/`safeDriverId` (`isVehicleId`/`isDriverId`), con el mismo patrón que `safeBranchId` de `ComprasPage.tsx`. Un valor inválido se ignora (sin filtro) y deja un `console.warn`. Antes: `urlState.filters.vehicleId as VehicleId | undefined`.
- **`LogisticsPage.tsx`**: el cálculo del rango desde el preset (las 4 líneas que repetían el cuerpo de `defaultDateRangeValue`) pasa a ser `return defaultDateRangeValue(preset)`. Se corrigieron los comentarios de `LogisticsPage` y de `dateRangePresets.ts`.
- **Borrado:** `SkeletonCard` (`SkeletonLoader.tsx`) y `.skeleton-card` (`SkeletonLoader.css`). No se usaban en ningún archivo de `src/`.
- **`money.ts#parseMoneyInput`**: convierte a centavos desplazando la coma en base 10, sin multiplicar en binario. Antes `"1.005"` → 100 centavos; ahora 101 (half-up). Además rechaza no finitos: antes `"Infinity"` → `Infinity` centavos; ahora lanza.
- **Docs:** PROTOCOLO §5 Gate 5 (definición de call-site real), ADR-006 (enmienda 2026-10-09), PENDIENTES #21 y el índice de DECISIONES_TECNICAS.

## Gates

| Gate | Resultado |
|---|---|
| 1 `tsc -b --noEmit` | exit 0 (línea base: exit 0) |
| 2 `eslint .` | 0 errores, 1 warning preexistente (`PurchaseOrderFormModal.tsx:183`, igual que la línea base) |
| 3 `vite build` | exit 0 |
| 4 smoke | `tanda-7.smoke.mjs`: 30 OK (eran 17), con 13 casos nuevos de `parseMoneyInput`. Los 27 scripts (18 smoke + 9 verificación) dan exit 0 |
| 5 conexión | `defaultDateRangeValue` → `LogisticsPage`, `isVehicleId`/`isDriverId` → `TripsPage`. Ninguna función exportada nueva. Los 3 de `money.ts` siguen sin consumidor y figuran en PENDIENTES #21 (excepción que habilita el Gate 5 nuevo) |
| 6 autorrevisión | el diff no agrega `any`, `@ts-ignore` ni `as <Tipo>Id` (solo elimina 2). No toca query keys ni services |
| 8 arquitectura | sin cambios de estructura de `src/` |

## Qué verificar en el navegador

En orden de riesgo:

1. **Viajes con ids basura en la URL.** Abrir `/logistica/viajes?vehicleId=basura` y después `/logistica/viajes?driverId=basura` (también los dos juntos). **Esperado:** la página no rompe y el listado se muestra sin filtrar por vehículo/chofer, igual que `ComprasPage` con una sucursal inválida. En la consola aparece `TripsPage: valor de vehiculo invalido en la URL, se ignora: "basura"` (o el de chofer). El `<select>` del filtro no muestra ningún vehículo/chofer elegido.
2. **Viajes filtrando por un vehículo real y por un chofer real** desde los selectores. **Esperado:** filtra igual que antes. La URL toma `vehicleId=veh-…`/`driverId=drv-…`, y al recargar la página el filtro se mantiene.
3. **Logística (Entregas), cada preset de fecha**: sin preset en la URL (default "Hoy"), "Todos", "Hoy", "Últimos 7 días", "Este mes", "Este trimestre" y "Personalizado" con fechas cargadas. **Esperado:** el mismo resultado que antes de la tanda. Probar también con la URL a mano: `?preset=thisMonth` sin `from`/`to` tiene que filtrar por el mes en curso, y `?preset=all` no tiene que filtrar por fecha.
4. **Regresión de skeletons:** cargar Cuentas Corrientes, Compras y el tablero. **Esperado:** los skeletons de tabla y de tarjetas KPI se ven como siempre (no usaban `SkeletonCard`).

Compras, Pendientes de Recepción, Cuentas Corrientes y Morosos **no** cambiaron. Derivan el rango distinto (no calculan desde el preset) y quedó documentado, no unificado.

## Qué NO se verificó

- Nada en el navegador.
- El texto del `console.warn` de `TripsPage` solo se revisó en el código.
