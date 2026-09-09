# Estado — SDGPD Frontend

**Corresponde a: 2026-09-08, commit `b5d1ea4` (rama `lean`).** Este es el único snapshot vigente del proyecto — reemplaza a `docs/historial/auditorias/AUDIT_00_RESUMEN.md` (que quedó fijado al 2026-09-06 y ya no describe el estado real) como lectura de entrada. **Reescribilo al cerrar cada sesión** — no alcanza con dejar el `REPORTE_<fecha>.md`, ese documenta lo que se hizo, este documenta dónde está el proyecto AHORA.

## Tandas — todas cerradas hasta acá (verificado contra `git log --oneline lean`)

Tanda 0 (contención de errores) → Tanda 1 (capa `api/`, piloto `suppliers`) → Tanda 2 (cache TanStack Query) → Tanda 2.5 (`useCachedQuery`, `httpClient` unificado) → Tandas 3a-3g (migración de `orders`, `cash`, `settings`, `clients`, `inventory` completo incluida Reposición) → Tanda 4 (contexto de sucursal + estado en URL) → Tanda 5 (IDs tipados) → Tanda 6 (exportación server-side) → Tanda 7 (tablero/analítica) → Tanda 8 (entregas) → Tanda B/C1/C2 (funciones huérfanas + export en el resto de los listados) → ADR-009 (alcance del dashboard) → barrido de `empresaId` en los 17 services → reorganización física de la documentación (`historial/`, `negocio/`, `_archivo/`).

**No hay ninguna tanda "a medias"**: todo lo de arriba tiene commit real en `lean`. Lo que sigue abajo no son tandas sin cerrar, son hallazgos que esas tandas no atacaron (fuera de su alcance declarado) o verificación en navegador que nunca se corrió.

## Hallazgos ALTO de `docs/historial/auditorias/` — reverificados hoy contra el código, siguen abiertos

- **`analytics` sigue sin ninguna capa de service ni paginación** (AUDIT_2 #4, AUDIT_3 #2) — `AnalyticsPage.tsx` sigue leyendo `ANALYTICS_DATA[period]` síncrono. Verificado: `find src/modules/analytics -maxdepth 1 -type d` → solo `components/`, sin `api/`.
- **Dinero sigue en `number` flotante fuera del dashboard** (AUDIT_10 #1) — el módulo `Money`/centavos (ADR-008) tiene 3 consumidores, los 3 en `modules/dashboard/`. Verificado: `grep -rl "from '@/shared/utils/money'" src` → 3 resultados, todos `dashboard`.
- **Impuesto sin redondeo de negocio** (AUDIT_10 #2) — `OrderTotalsSection.tsx:18`, `tax = (subtotal - discount) * taxRate` sigue igual, sin `Math.round`.
- **Sin code-splitting, bundle único y creciendo** (AUDIT_8 #1/#2) — `grep "lazy(" src/shared/routes/AppRoutes.tsx` → 0 resultados. Bundle hoy: 1.526,70 kB (era 1.470,62 kB en la auditoría) — empeoró, no mejoró.
- **Solo 2 formularios usan Zod** (AUDIT_9 #1) — `grep -rl "zodResolver(" src` → `ProductFormModal.tsx`, `PurchaseOrderFormModal.tsx`. `SupplierFormModal`/`CreateClientModal`/`NewTransactionModal` siguen sin schema.

## Hallazgos ALTO ya resueltos (verificados, no listar como pendientes)

`CreateOrderModal` con fecha UTC en vez de local (AUDIT_11 #1, fix en `97f9643`) · estado de listados fuera de la URL (AUDIT_13 #1, Tanda 4) · `Order` resuelto por nombre en vez de `clientId` tipado (AUDIT_4 #1, Tanda 5) · Reposición sin service/paginar (AUDIT_2 #1, AUDIT_3 #1, AUDIT_14 #5, Tanda 3f).

## Checklists de verificación en navegador — sin evidencia de haberse ejecutado

Ningún commit en el historial dice "confirmado en navegador" sobre ninguno de los checklists de `docs/historial/verificaciones/` (21 archivos) — asumir que **todos** siguen pendientes de que Leandro los corra, no solo los que dicen explícitamente "PENDIENTE"/"NO EJECUTADA" en su propio texto (3 de 21 lo dicen; el resto simplemente nunca reporta el resultado).

## Deuda técnica viva

Ver `docs/PENDIENTES.md` (14 ítems numerados, cada uno con severidad y estado — no se copia acá porque cambia con cada tanda).
