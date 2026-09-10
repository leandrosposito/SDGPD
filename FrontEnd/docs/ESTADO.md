# Estado — SDGPD Frontend

**Corresponde a: 2026-09-09, rama `lean` (`sesion-tanda9-logistica` y `sesion-codesplitting` ya mergeadas).** Este es el único snapshot vigente del proyecto — reemplaza a `docs/historial/auditorias/AUDIT_00_RESUMEN.md` (que quedó fijado al 2026-09-06 y ya no describe el estado real) como lectura de entrada. **Reescribilo al cerrar cada sesión** — no alcanza con dejar el `REPORTE_<fecha>.md`, ese documenta lo que se hizo, este documenta dónde está el proyecto AHORA.

## Tandas — todas cerradas hasta acá (verificado contra `git log --oneline lean` + la sesión en curso)

Tanda 0 (contención de errores) → Tanda 1 (capa `api/`, piloto `suppliers`) → Tanda 2 (cache TanStack Query) → Tanda 2.5 (`useCachedQuery`, `httpClient` unificado) → Tandas 3a-3g (migración de `orders`, `cash`, `settings`, `clients`, `inventory` completo incluida Reposición) → Tanda 4 (contexto de sucursal + estado en URL) → Tanda 5 (IDs tipados) → Tanda 6 (exportación server-side) → Tanda 7 (tablero/analítica) → Tanda 8 (entregas) → Tanda B/C1/C2 (funciones huérfanas + export en el resto de los listados) → ADR-009 (alcance del dashboard) → barrido de `empresaId` en los 17 services → reorganización física de la documentación (`historial/`, `negocio/`, `_archivo/`) → ADR-010/ADR-011 Aceptados (con correcciones 2026-09-09) + Tanda 9, modelo logístico base (ver `docs/historial/verificaciones/VERIFICACION_TANDA_9.md`) → **ADR-012 Aceptado + Tanda 10A, code-splitting por ruta** (ver `docs/historial/verificaciones/VERIFICACION_TANDA_10A.md`).

**No hay ninguna tanda "a medias"**: todo lo de arriba tiene commit real, mergeado a `lean`. Lo que sigue abajo no son tandas sin cerrar, son hallazgos que esas tandas no atacaron (fuera de su alcance declarado) o verificación en navegador que nunca se corrió.

## Tanda 9 — qué resolvió y qué no (AUDIT_15_LOGISTICA.md)

Resolvió, del modelo y circuito de datos solamente (vehículos/choferes/viajes/asignación/mapas/POD son la tanda siguiente, ADR-011): alta de `Delivery` desde un pedido (A15#1, antes inexistente), los 3 ejes comercial/logístico/financiero con migración incremental sin romper `status` legado (A15#2), idempotencia en `transitionDelivery`/`reprogramDelivery`/`registrarEntrega`/`createDelivery` (A15#5, con 2 bugs propios corregidos en una sesión de recuperación), `DeliveryNoteId`/`DeliveryHistoryEventId` tipados (A15#13), catálogo de motivos con `requiereEvidencia`/`disparaLogisticaInversa` (declarados en el tipo y en el mock, sin consumidor de comportamiento todavía — hallazgo de Fase 3, no bloqueante), `allowedTransitions` server-side en el contrato de lectura.

**A15#3 (sincronización pedido↔entrega) — CERRADO.** El diseño (derivar siempre, nunca copiar el estado) cierra la clase de bug que la migración a medias temía. La Fase 3 encontró y corrigió DOS caminos reales donde igual divergían pese al diseño: `registrarEntrega` reportaba éxito sin esperar la propagación al pedido (sesión de recuperación), y `cancelOrder` no chequeaba si el pedido tenía una `Delivery` activa antes de cancelar (fix en una sesión posterior — ahora `cancelOrder` devuelve `reason:'has-active-deliveries'` y no cancela; `OrderDetailPanel.tsx#canCancel` oculta el botón para el mismo caso, con guard fail-closed también si el fetch de entregas está cargando o falló). Alcance del segundo fix, deliberadamente chico: bloquea cancelar, no cancela las entregas en cascada — esa decisión de producto sigue sin ADR y sin tomar.

Quedó explícitamente fuera de alcance (documentado en ADR-010/011 y en `VERIFICACION_TANDA_9.md`): reverse logística completa (movimiento de stock), POD, vocabulario real de 11 estados de Parada, migración de `OrdersPage`/exports al eje `comercial`, cascada automática de cancelación pedido→entregas.

## Hallazgos ALTO de `docs/historial/auditorias/` — reverificados hoy contra el código, siguen abiertos

- **`analytics` sigue sin ninguna capa de service ni paginación** (AUDIT_2 #4, AUDIT_3 #2) — `AnalyticsPage.tsx` sigue leyendo `ANALYTICS_DATA[period]` síncrono. Verificado: `find src/modules/analytics -maxdepth 1 -type d` → solo `components/`, sin `api/`.
- **Dinero sigue en `number` flotante fuera del dashboard** (AUDIT_10 #1) — el módulo `Money`/centavos (ADR-008) tiene 3 consumidores, los 3 en `modules/dashboard/`. Verificado: `grep -rl "from '@/shared/utils/money'" src` → 3 resultados, todos `dashboard`.
- **Impuesto sin redondeo de negocio** (AUDIT_10 #2) — `OrderTotalsSection.tsx:18`, `tax = (subtotal - discount) * taxRate` sigue igual, sin `Math.round`.
- **Solo 2 formularios usan Zod** (AUDIT_9 #1) — `grep -rl "zodResolver(" src` → `ProductFormModal.tsx`, `PurchaseOrderFormModal.tsx`. `SupplierFormModal`/`CreateClientModal`/`NewTransactionModal` siguen sin schema.

## Hallazgos ALTO ya resueltos (verificados, no listar como pendientes)

`CreateOrderModal` con fecha UTC en vez de local (AUDIT_11 #1, fix en `97f9643`) · estado de listados fuera de la URL (AUDIT_13 #1, Tanda 4) · `Order` resuelto por nombre en vez de `clientId` tipado (AUDIT_4 #1, Tanda 5) · Reposición sin service/paginar (AUDIT_2 #1, AUDIT_3 #1, AUDIT_14 #5, Tanda 3f) · **Sin code-splitting, bundle único y creciendo** (AUDIT_8 #1/#2, Tanda 10A/ADR-012 — `grep "lazy(" src/shared/routes/AppRoutes.tsx` → 10 resultados; chunk de entrada bajó de 1.537,42 kB a ~344 kB repartidos en 5 archivos, ver `docs/historial/reportes/REPORTE_2026-09-09_codesplitting.md`).

## Checklists de verificación en navegador — sin evidencia de haberse ejecutado

Ningún commit en el historial dice "confirmado en navegador" sobre ninguno de los checklists de `docs/historial/verificaciones/` (23 archivos, incluye `VERIFICACION_TANDA_9.md` y `VERIFICACION_TANDA_10A.md`) — asumir que **todos** siguen pendientes de que Leandro los corra, no solo los que dicen explícitamente "PENDIENTE"/"NO EJECUTADA" en su propio texto (3 de 23 lo dicen; el resto simplemente nunca reporta el resultado).

## Deuda técnica viva

Ver `docs/PENDIENTES.md` (14 ítems numerados, cada uno con severidad y estado — no se copia acá porque cambia con cada tanda).
