# ADR-BE-010 — Cuenta corriente y caja

**Estado:** Aceptado. **Fecha:** 2026-10-07. **Resuelve:** decisión #17 de [`08_DECISIONES_ABIERTAS.md`](../../../FrontEnd/docs/historial/auditorias/backend/08_DECISIONES_ABIERTAS.md), y el detalle de caja de la #18. En la tabla de trazabilidad, la #18 está asignada a ADR-BE-002, que fija los alcances.

**Enmienda a ADRs del frontend:** ninguno.

## Contexto

**Cuenta corriente:**
- `ClientAccount.transactions` está embebido en el cliente y **ninguna operación lo escribe** (hallazgo **A21**).
- Persiste derivados que nunca se recalculan: `currentBalance`, `status`, `daysOverdue` y `ClientTransaction.balance` (`FrontEnd/src/shared/types/client.types.ts:51-97`).
- La imputación de pagos (FIFO) se calcula en cada consulta y no se guarda (`clients.service.ts`, RF-CCT-002).

**Caja:**
- No tiene sucursal ni fecha: `CashTransaction.time = '08:45:00'`, sin día (`cash.types.ts:22-31`).
- No tiene apertura ni cierre (RF-TES-002/004).
- No valida que `category` sea coherente con `type` (**M13**).
- Mezcla categorías en inglés y en español (**L3**, `cash.types.ts:6-20`).

## Decisión

### Cuenta corriente
- **Registro propio append-only**, con **saldo materializado por cliente y moneda**.
- **El débito lo genera la factura, no el remito.** Hace falta un **ADR de Facturación antes de BE-9** (resolución de la objeción 1): primero factura interna no fiscal, la electrónica fiscal después.
- **La imputación de pagos se persiste**, con FIFO como sugerencia.
- **La antigüedad de deuda se calcula por consulta** y no se guarda.
- **Límite de crédito** (resolución de la objeción 2): la **exposición** del cliente es `saldo de la cuenta corriente + importe de los pedidos confirmados todavía no facturados`. Se controla **al confirmar el pedido**; si se supera, **422 `credit-limit-exceeded`**. Se puede **forzar con el permiso "aprobar"** (ADR-BE-003, sub-decisión 6), y queda registrado **quién lo forzó y por qué**.

### Caja
- **Alcance sucursal.**
- **Cada movimiento lleva fecha y hora completas.**
- **Hay apertura y cierre.**
- **La vista de empresa es un agregado.**

## Alternativas descartadas (08 #17, #18)

- **Seguir derivando la cuenta corriente** de los documentos en cada lectura (el modelo actual): sin registro propio, no hay saldo auditable ni imputación persistida (RF-CCT-002).
- **Débito al remitir:** contradice la separación Entrega ≠ Factura ≠ Cobro de Doc 03 §4.24, y RF-FAC-001 ("al emitir una factura, el saldo deudor … debe incrementarse").
- **Caja de alcance empresa** (como dice hoy `PROTOCOLO.md` §1): una caja física es de un lugar (RF-TES-002), y el arqueo se hace por caja.

## Consecuencias para el backend

- **Cuenta corriente:**
  - `account_entries (empresa_id, client_id, currency, kind, document_id, amount, at)` append-only, más `account_balances (empresa_id, client_id, currency, balance)` materializado en la misma transacción.
  - `payment_allocations (entry_pago, entry_factura, amount)` para la imputación. El endpoint de imputación propone FIFO y el usuario confirma o ajusta.
  - La antigüedad de deuda (aging) sale de una consulta sobre facturas con saldo abierto.
- **Caja:**
  - `cash_registers` (caja por sucursal), `cash_sessions` (apertura y cierre, con usuario e importes) y `cash_movements` (fecha y hora completas, `cash_session_id`, tipo, categoría, importe en centavos).
  - Un movimiento sin sesión abierta se rechaza con 422.
  - La vista empresa es `GROUP BY` sobre las sucursales.

## Consecuencias para el frontend

- **Clientes:**
  - `ClientAccount` deja de traer `transactions` embebidas. Los movimientos pasan a un endpoint propio con cursor (ADR-BE-004).
  - `currentBalance`/`status`/`daysOverdue` vienen calculados del servidor.
  - `ClientAccountsTable` y `ClientOverdueTable` consumen saldos por moneda.
- **Caja:**
  - `CashPage` necesita `branchId` (alcance sucursal; regla 3.4) y una UI de apertura y cierre, que hoy no existe.
  - `NewTransactionModal` deja de mandar la hora: la pone el servidor.
  - Las categorías salen de una lista única en `contracts`.

## Hallazgos que cierra

- **A21** (nadie escribe la cuenta corriente). Ver la objeción 1: en los hechos queda abierto hasta que exista la factura.
- **M13** (caja sin fecha, sin filtros, sin coherencia de categoría).
- **L3** (categorías en dos idiomas).

## Sub-decisiones (aprobadas 2026-10-08)

1. **Una sesión de caja abierta por caja a la vez**, y **una caja por sucursal** en BE-0..10 (la tabla admite varias).
2. **Cierre con arqueo:** el usuario declara lo contado; el sistema calcula lo esperado y registra la diferencia como un hecho del cierre. No hay ajuste automático (mismo criterio que la recepción de devolución de ADR-010 §6).
3. **Cobro → recibo → crédito en la cuenta corriente:** un cobro a cliente registrado en caja genera un **recibo** (numerado `RCB`, ADR-BE-006) y un crédito en la cuenta corriente, **en la misma transacción** (ADR-BE-005).
4. **Categorías de caja:** una sola lista, en español y `snake_case` (`cobro`, `pago_proveedor`, `gasto`, `aporte`, `retiro`, `anticipo_ingreso`, `anticipo_egreso`, `otros_ingresos`, `otros_egresos`). Cada categoría está ligada a un solo `type` (`income|expense`). Las variantes en inglés (`sale`, `collection`, `supplier`, `expense`, `advance`) se mapean a esas al migrar.
5. **Saldo inicial de una sesión de caja:** el saldo de cierre de la sesión anterior de esa caja. Hoy es una constante (`CASH_MOCK_DATA.initialBalance`, `cash.service.ts:74`).

## Objeciones

1. **"El débito lo genera la factura" y Facturación no tiene ADR ni tanda.** RF-FAC-001..004 no tienen contrato (`06_COBERTURA_RF.md`), y ADR-BE-006 deja "la numeración fiscal para el ADR de Facturación". Con la decisión tal cual, **la cuenta corriente no recibe ningún débito hasta que exista la factura**. A21 queda formalmente resuelto en diseño, pero sin operación que lo ejercite. Mientras tanto, los pedidos con `paymentMethod: 'Cuenta Corriente'` (`order.types.ts:40`) no generan deuda.

   **Resolución (2026-10-08):** **la factura sigue siendo el origen del débito.** Hace falta un **ADR de Facturación antes de BE-9**: primero **factura interna no fiscal**, la **electrónica fiscal después**. Hasta BE-9 los pedidos en cuenta corriente no generan deuda, y **eso queda aceptado porque no hay nada en producción**. El ADR de Facturación queda como **prerrequisito de BE-9** en el plan de tandas del README.
2. **El control de límite de crédito (RF-CLI-002)** necesita saber cuánta deuda "comprometida" tiene el cliente: pedidos confirmados y todavía sin facturar. Si el débito nace con la factura, el saldo de la cuenta no alcanza para bloquear un pedido nuevo. Ninguna decisión define contra qué se compara `creditLimit`.

   **Resolución (2026-10-08):** **exposición = saldo de la cuenta corriente + importe de los pedidos confirmados todavía no facturados.** Se controla **al confirmar el pedido**; si se supera, **422 `credit-limit-exceeded`**. Se puede **forzar con el permiso "aprobar"**, y queda registrado **quién lo forzó y por qué** (además de la auditoría genérica de ADR-BE-005). Escrito en la sección Decisión › Cuenta corriente.
