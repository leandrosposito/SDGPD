# Verificación Tanda 20 — SKUs huérfanos del seed de pedidos (PENDIENTES.md ítem 19, parte dato)

**Fecha:** 2026-10-07. Ver `docs/historial/auditorias/AUDIT_2026-10-07b_seed-skus.md`.

## Qué cambió

Solo `src/data/mock/orders.data.ts`, 5 líneas. Cambian únicamente `sku` y `name`:

| Línea | Antes | Después |
|---|---|---|
| `ord-001`/`oi-102`, `ord-006`/`oi-601` | `YER-TAR-1K` "Yerba Taragui 1kg" | `YER-MAT-1K` "Yerba Mate 1kg Paquete" (`inv-002`) |
| `ord-001`/`oi-103`, `ord-003`/`oi-301`, `ord-004`/`oi-402` | `GAL-SUR-200` "Galletitas Surtidas 200g" | `GAL-AGU-200` "Galletitas de Agua 200g" (`inv-005`) |

**Decisión (regla 2.9):** `quantity`, `unitPrice` y `subtotal` **no se tocaron**. La línea de pedido es una foto del precio del momento del pedido (precedente: `oi-101` "Aceite Girasol 1.5L" contra el catálogo "Aceite de Girasol 1.5L"). Corregir `unitPrice` 450 → 420 en galletitas habría cambiado los totales de 3 pedidos y todo lo que deriva de ellos.

**Regla 2.5:** el check D2.3 de `v17-clientes-inactivos.mjs` **no se modificó**. Se arregló el dato. `git diff` de la tanda: solo `orders.data.ts`.

## Gates

| Gate | Resultado |
|---|---|
| 1 `tsc -b` | exit 0 |
| 2 `eslint .` | 0 errores, 1 warning preexistente |
| 3 `vite build` | `✓ built in 2.25s` |
| 4 smoke | no aplica (no hay lógica nueva). Se corrieron **los 16 smoke y las 9 verificaciones**, porque 6 scripts leen `ORDERS_MOCK_DATA`: **25/25 en exit 0**. V17 pasó de exit 1 (`FAIL toda linea de pedido del seed apunta a un sku existente`) a exit 0 (`OK toda linea de pedido del seed apunta a un sku existente`) |
| 5, 6, 8 | sin funciones nuevas, sin código, sin cambios de estructura |

## Qué verificar en el navegador

1. `/pedidos` → detalle de `PED-00391`: las líneas dicen "Yerba Mate 1kg Paquete" (`YER-MAT-1K`) y "Galletitas de Agua 200g" (`GAL-AGU-200`), y el **total sigue siendo $57.172,50**.
2. Detalle de `PED-00389`, `PED-00388` y `PED-00386`: mismos nombres nuevos, totales sin cambios.
3. `/analitica`: sigue mostrando "Yerba Taragui"/"Galletitas 200g" en los rankings. **Es esperado**: `analytics.data.ts` no se tocó (ver la auditoría, hallazgos al pasar).

## Qué NO se verificó

- Nada en el navegador.
- Los otros 3 lugares con el mismo dato huérfano (`analytics.data.ts`, `suppliers.data.ts`, nombres de `alerts.data.ts`) quedan documentados, no corregidos.
