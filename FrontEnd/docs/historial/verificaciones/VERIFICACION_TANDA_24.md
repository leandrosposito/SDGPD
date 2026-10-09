# Verificación Tanda 24 — Rango de fechas en la URL (PROTOCOLO 3.8, enmienda 2026-10-09)

**Fecha:** 2026-10-09. Rama `sesion-dinero-fechas-2026-10-09`.

## Qué cambió

- **`shared/components/ui/dateRangePresets.ts`:**
  - `readDateRangeFromUrl(params, defaultPreset, today?)` y `dateRangeToUrlParams(value, defaultPreset)` son el único lugar que lee y escribe `preset`/`from`/`to`.
  - `defaultDateRangeValue` acepta un `today` opcional.
  - Un preset inválido en la URL se valida con un guard, sin cast.
- **Los 5 listados con `DateRangeFilter` usan los helpers:**
  - `LogisticsPage` (default `today`)
  - `ComprasPage` (`oc_`)
  - `TabPendingReceipt` (`rec_`)
  - `ClientAccountsTable` (`acc_`)
  - `ClientOverdueTable` (`over_`)

  Ninguno arma el rango a mano.
- **Regla:**
  - Preset fijo: el rango se calcula al renderizar, y `from`/`to` no se escriben ni se leen.
  - `custom`: `from`/`to` salen de la URL.
  - `from`/`to` sin preset: se interpretan como `custom`.
  - Los defaults no cambian.
- **Docs:** PROTOCOLO 3.8, enmienda 2026-10-09.
- **Smoke nuevo:** `scripts/smoke/tanda-24.smoke.mjs`, 29 casos.

## Gates

| Gate | Resultado |
|---|---|
| 1 `tsc -b --noEmit` | exit 0 |
| 2 `eslint .` | 0 errores, 1 warning preexistente |
| 3 `vite build` | exit 0 |
| 4 smoke | `tanda-24.smoke.mjs`: 29 OK, exit 0 |
| 5 conexión | `readDateRangeFromUrl`/`dateRangeToUrlParams` tienen call-site en los 5 listados. `defaultDateRangeValue` cumple (b), vía `readDateRangeFromUrl` |
| 6 autorrevisión | se eliminan 5 casts del preset que venía de la URL (`as DateRangePreset`/`as DateRangeValue['preset']`). Las query keys incluyen el rango calculado |
| 8 arquitectura | sin cambios de estructura de `src/` |

## Qué verificar en el navegador

En **cada** uno de los 5 listados: Logística (Entregas), Compras → Órdenes de Compra, Compras → Pendientes de Recepción, Clientes → Cuentas Corrientes y Clientes → Morosos.

1. **Elegir cada preset y mirar la URL.** "Hoy", "Últimos 7 días", "Este mes" y "Este trimestre" escriben solo `preset` (con el prefijo del listado, por ejemplo `oc_preset=thisMonth`), **sin** `from`/`to`. "Todos" no escribe nada en los listados con default "Todos"; en Logística escribe `preset=all`. "Hoy" en Logística no escribe nada (es su default). "Personalizado" escribe `preset=custom` + `from` + `to`.
2. **Link viejo:** pegar a mano `?preset=thisMonth&from=2026-09-01&to=2026-09-30`, con el prefijo del listado (por ejemplo `?oc_preset=thisMonth&oc_from=2026-09-01&oc_to=2026-09-30`). **Esperado:** filtra por el **mes actual** (del 1 a hoy), no por septiembre, y el selector dice "Este mes".
3. **Personalizado conserva sus fechas al recargar:** elegir "Personalizado", cargar desde y hasta, y recargar (F5). Las fechas y el filtro siguen ahí.
4. **Atrás/adelante del navegador:** cambiar de preset dos o tres veces y usar Atrás y Adelante. Cada paso muestra el filtro que corresponde a la URL de ese paso, y el listado se recarga.
5. **Cambio de Personalizado a un preset fijo:** `from`/`to` desaparecen de la URL.
6. **Sin parámetros:** Logística muestra "Hoy" y el resto "Todos", igual que antes.

## Qué NO se verificó

- Nada en el navegador.
- `OrdersPage` (Pedidos) **no** se tocó. No usa `DateRangeFilter` ni presets, solo dos inputs `from`/`to` (custom permanente), así que no tiene el problema de la etiqueta que no coincide con el rango.
