# BE-09 — Caja, cuenta corriente y facturación

**Verificación:** 2026-10-10 contra `lean=e719e96c870244bc67756f3fa91f929315ef761c`. **Estado:** bloqueada por D-01 (ADR de Facturación), además de BE-03/04.

## 1. Encabezado

No hay caja/ledger backend de negocio en `lean`; BE-0b audit_log no es cuenta corriente.

## 2. Objetivo

Operar caja por sucursal con apertura/cierre/arqueo, registrar recibos e imputaciones Money y mantener cuenta corriente append-only por cliente/moneda, sin generar débitos hasta que D-01 lo autorice.

## 3. Depende de

BE-03 Client/Money; BE-04 branch stock no directo; BE-05 confirmed orders/exposure; D-01 Facturación; BE-1 actor/permissions/branches. D-06 no es dependencia directa.

## 4. ADRs

ADR-BE-010: ledger append-only y balances materializados, débito nace en factura, FIFO persistida sugerida, caja SUCURSAL con sesiones/open-close/arqueo, exposure saldo+confirmed unbilled y override `aprobar`. ADR-BE-006: Money/series RCB. ADR-BE-002: caja branch. ADR-BE-004/005: DTO/errors/transaction/idempotency. Objeción de BE-010 mantiene no-debits until Billing ADR.

## 5. Modelo de datos

`cash_registers(empresa_id,id,branch_id,name,active)`, `cash_sessions` open/closed/initial/final/counts/version, `cash_movements` append-only Money/category/actor/receiptId. `account_entries(empresa_id,id,client_id,currency,kind,amount,sourceType/sourceId,occurredAt)` append-only; `account_balances` materialized `(client,currency)`; `payment_allocations` receipt→entry amount. `receipts` series RCB. RLS FORCE; branch on cash, company on client ledger with client FK. No floats/time-only/entity text; category code constrained.

## 6. Endpoints y contratos

Permissions cash × `ver|crear|editar|aprobar`; clients accounts × `ver|crear|aprobar`.

| Método/path | Contrato | Reemplaza |
|---|---|---|
| GET `/api/cash/sessions` | branch offset | #1 |
| POST `/api/cash/sessions/open`, close, count | commands/version | no endpoint |
| GET `/api/cash/movements`/export | cursor/job | #1–2 |
| POST `/api/cash/movements` | Money/category/session, idempotent | #3 |
| GET `/api/clients/accounts`/overdue | offset + aggregates/monetary buckets | #10–13 |
| POST `/api/clients/:id/receipts` | RCB, allocations, Money | no endpoint |
| GET `/api/clients/:id/account` | cursor entries/balance | no endpoint |

No empresaId/actor; branch query/body. Errors `cash-already-open`, `cash-not-open`, `cash-already-closed`, `amount-invalid`, `category-invalid`, `credit-limit-exceeded`, `allocation-invalid`, `currency-mismatch`, `version-conflict`; Facturación errors are D-01. Debits from invoice endpoint belong to Billing, not invented here.

## 7. Reglas de negocio

R-CAJ-1 amount >0; R-CAJ-2 category coheres with type and open session; one open session/branch, close requires counted amounts and immutable closure. Receipt creates RCB, cash movement and payment allocation atomically; FIFO allocation is persisted and never crosses currency. A13/A21 close only after ledger and version. Credit exposure check at order confirmation can block/force with approve permission and audit, but actual debt requires D-01.

## 8. Seed y datos

No import relative cash register as final entity. Seed one closed/open fixture per branch with fixed timestamps and Money; migrate client transactions only if D-01 defines source, otherwise leave account empty. `PENDING_VOUCHERS_MOCK` is not seed. Create receipt fixtures with explicit currency and allocations.

## 9. Arrastre frontend

`FrontEnd/src/modules/cash/api/{cash.service,dto,mapper}.ts`, `CashPage.tsx`, `NewTransactionModal.tsx`, clients `clients.service.ts`, `ClientAccountsTable.tsx`, `ClientOverdueTable.tsx`, order confirm UI and `shared/utils/money.ts`.

Add cash/accounts flags; branch from session; Money/no float; cash session UI; replace relative date/time; account statuses derived codes; server aggregates/FIFO; remove direct transaction arrays. Don't wire account debit UI until D-01.

## 10. Tests obligatorios

Tenant/branch isolation; open/close/count concurrency; category/type; Money currencies; receipt/idempotency/version; allocation FIFO and no cross currency; append-only no update/delete; permission approve/force; credit-limit exposure; no debit without invoice; offset/cursor/aggregates; seed.

## 11. Qué cierra

RF-CCT-001..003, RF-TES-001..005, endpoints #1–#3 and #10–#13, entity CashTransaction/CashRegister, rules R-CAJ-1..2, findings A13/A21/M13. RF-FAC remains D-01. IDs: RF-CCT-001, RF-CCT-002, RF-CCT-003, RF-TES-001, RF-TES-002, RF-TES-003, RF-TES-004, RF-TES-005, R-CAJ-1, R-CAJ-2, A13, A21, M13, 1, 2, 3, 10, 11, 12, 13, CashTransaction / CashRegister.

## 12. Dependencias nuevas

D-01 may authorize a fiscal provider later; BE-09 itself uses existing stack only. No payment gateway is assumed.

## 13. Decisiones abiertas

`[ABIERTO D-01]` Facturación; D-05 address no direct effect; D-09 operations. Until D-01, no account debits and BE-09 cannot close.

## 14. Riesgos y trampas

No call receipt “invoice”; no sum ARS/USD; no delete ledger; no cash company-wide; no client-supplied actor/time; no force without approve; no hide debt behind derived float fields.

## 15. Tamaño

Partir 9a cash sessions/movements and 9b account/receipts/credit. Billing integration is a separate gate after D-01.

## 16. Lista cuando

D-01 ADR accepted; schema/RLS/DTO/transactions/tests pass; cash/session/receipts/FIFO/credit behavior verified; no debits before invoice; frontend Money/branch connected; checklist/report/gates and `docs:check BE-09` green.
