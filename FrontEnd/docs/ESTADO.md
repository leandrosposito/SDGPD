# Estado — SDGPD Frontend

**Corresponde a: 2026-09-09, rama `sesion-tanda9-logistica` — SIN MERGEAR a `lean`, a propósito: la Fase 3 (autoauditoría) de esta tanda dejó un hallazgo ALTO abierto (ver más abajo), y PROTOCOLO.md prohíbe mergear con un ALTO sin corregir.** Este es el único snapshot vigente del proyecto — reemplaza a `docs/historial/auditorias/AUDIT_00_RESUMEN.md` (que quedó fijado al 2026-09-06 y ya no describe el estado real) como lectura de entrada. **Reescribilo al cerrar cada sesión** — no alcanza con dejar el `REPORTE_<fecha>.md`, ese documenta lo que se hizo, este documenta dónde está el proyecto AHORA.

## Tandas — todas cerradas hasta acá (verificado contra `git log --oneline lean` + la sesión en curso)

Tanda 0 (contención de errores) → Tanda 1 (capa `api/`, piloto `suppliers`) → Tanda 2 (cache TanStack Query) → Tanda 2.5 (`useCachedQuery`, `httpClient` unificado) → Tandas 3a-3g (migración de `orders`, `cash`, `settings`, `clients`, `inventory` completo incluida Reposición) → Tanda 4 (contexto de sucursal + estado en URL) → Tanda 5 (IDs tipados) → Tanda 6 (exportación server-side) → Tanda 7 (tablero/analítica) → Tanda 8 (entregas) → Tanda B/C1/C2 (funciones huérfanas + export en el resto de los listados) → ADR-009 (alcance del dashboard) → barrido de `empresaId` en los 17 services → reorganización física de la documentación (`historial/`, `negocio/`, `_archivo/`) → **ADR-010/ADR-011 Aceptados (con correcciones 2026-09-09) + Tanda 9, modelo logístico base** (ver `docs/historial/verificaciones/VERIFICACION_TANDA_9.md`).

**No hay ninguna tanda "a medias"**: todo lo de arriba tiene commit real (Tanda 9 + su fix post-Fase-2 en la rama de sesión, ambos pusheados, pendientes de merge a `lean` hasta que se corrija o se acepte formalmente el hallazgo ALTO de abajo). Lo que sigue abajo no son tandas sin cerrar, son hallazgos que esas tandas no atacaron (fuera de su alcance declarado) o verificación en navegador que nunca se corrió.

## Tanda 9 — qué resolvió y qué no (AUDIT_15_LOGISTICA.md)

Resolvió, del modelo y circuito de datos solamente (vehículos/choferes/viajes/asignación/mapas/POD son la tanda siguiente, ADR-011): alta de `Delivery` desde un pedido (A15#1, antes inexistente), los 3 ejes comercial/logístico/financiero con migración incremental sin romper `status` legado (A15#2), idempotencia en `transitionDelivery`/`reprogramDelivery`/`registrarEntrega`/`createDelivery` (A15#5, con 2 bugs propios corregidos en una sesión de recuperación — ver abajo), `DeliveryNoteId`/`DeliveryHistoryEventId` tipados (A15#13), catálogo de motivos con `requiereEvidencia`/`disparaLogisticaInversa` (declarados en el tipo y en el mock, sin consumidor de comportamiento todavía — hallazgo de Fase 3, no bloqueante), `allowedTransitions` server-side en el contrato de lectura.

**A15#3 (sincronización pedido↔entrega) — PARCIAL, no cerrado del todo:** el diseño (derivar siempre, nunca copiar el estado) es correcto y cierra la clase de bug que la migración a medias temía, y la Fase 3 de esta sesión encontró y corrigió un camino real donde SÍ divergían (`registrarEntrega` reportaba éxito sin esperar la propagación al pedido — ver el fix commit). Pero la MISMA Fase 3 encontró un segundo camino, sin corregir: **cancelar un pedido no toca sus `Delivery` activas** — ver el hallazgo ALTO más abajo. A15#3 no se puede dar por cerrado hasta que ese camino también se resuelva.

Quedó explícitamente fuera de alcance (documentado en ADR-010/011 y en `VERIFICACION_TANDA_9.md`): reverse logística completa (movimiento de stock), POD, vocabulario real de 11 estados de Parada, migración de `OrdersPage`/exports al eje `comercial`.

## Hallazgo ALTO abierto — bloquea el merge de `sesion-tanda9-logistica` a `lean`

**Cancelar un pedido no cancela ni avisa sobre sus entregas ya creadas** (`orders.service.ts#cancelOrder` solo escribe `ordersDTOStore`, nunca mira `deliveriesStore`; el botón "Cancelar" del panel de pedido tampoco chequea si hay una `Delivery` activa). Un pedido puede quedar "Cancelado" mientras su entrega sigue su curso normal (sale a ruta, se cobra `collectionAmount`, se finaliza) sin ningún bloqueo. Detalle completo, repro y por qué no se corrigió esta sesión: `docs/historial/verificaciones/VERIFICACION_TANDA_9.md`, sección "Hallazgo ALTO abierto". Requiere una decisión de producto (¿cascada automática? ¿bloquear "Cancelar" si hay entrega activa?) que ningún ADR cubre todavía — no se tomó unilateralmente porque no estaba en el alcance pedido para esta sesión.

## Hallazgos ALTO de `docs/historial/auditorias/` — reverificados hoy contra el código, siguen abiertos

- **`analytics` sigue sin ninguna capa de service ni paginación** (AUDIT_2 #4, AUDIT_3 #2) — `AnalyticsPage.tsx` sigue leyendo `ANALYTICS_DATA[period]` síncrono. Verificado: `find src/modules/analytics -maxdepth 1 -type d` → solo `components/`, sin `api/`.
- **Dinero sigue en `number` flotante fuera del dashboard** (AUDIT_10 #1) — el módulo `Money`/centavos (ADR-008) tiene 3 consumidores, los 3 en `modules/dashboard/`. Verificado: `grep -rl "from '@/shared/utils/money'" src` → 3 resultados, todos `dashboard`.
- **Impuesto sin redondeo de negocio** (AUDIT_10 #2) — `OrderTotalsSection.tsx:18`, `tax = (subtotal - discount) * taxRate` sigue igual, sin `Math.round`.
- **Sin code-splitting, bundle único y creciendo** (AUDIT_8 #1/#2) — `grep "lazy(" src/shared/routes/AppRoutes.tsx` → 0 resultados. Bundle hoy: 1.536,97 kB (era 1.470,62 kB en la auditoría, 1.526,70 kB antes de Tanda 9) — empeoró, no mejoró.
- **Solo 2 formularios usan Zod** (AUDIT_9 #1) — `grep -rl "zodResolver(" src` → `ProductFormModal.tsx`, `PurchaseOrderFormModal.tsx`. `SupplierFormModal`/`CreateClientModal`/`NewTransactionModal` siguen sin schema.

## Hallazgos ALTO ya resueltos (verificados, no listar como pendientes)

`CreateOrderModal` con fecha UTC en vez de local (AUDIT_11 #1, fix en `97f9643`) · estado de listados fuera de la URL (AUDIT_13 #1, Tanda 4) · `Order` resuelto por nombre en vez de `clientId` tipado (AUDIT_4 #1, Tanda 5) · Reposición sin service/paginar (AUDIT_2 #1, AUDIT_3 #1, AUDIT_14 #5, Tanda 3f).

## Checklists de verificación en navegador — sin evidencia de haberse ejecutado

Ningún commit en el historial dice "confirmado en navegador" sobre ninguno de los checklists de `docs/historial/verificaciones/` (22 archivos, incluye `VERIFICACION_TANDA_9.md`) — asumir que **todos** siguen pendientes de que Leandro los corra, no solo los que dicen explícitamente "PENDIENTE"/"NO EJECUTADA" en su propio texto (3 de 22 lo dicen; el resto simplemente nunca reporta el resultado).

## Deuda técnica viva

Ver `docs/PENDIENTES.md` (14 ítems numerados, cada uno con severidad y estado — no se copia acá porque cambia con cada tanda).
