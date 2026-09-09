# Registro de Decisiones Técnicas — Índice

Este archivo es un ÍNDICE, no el log. El detalle completo de cada decisión (contexto, alternativas, verificación en navegador) vive en `docs/historial/DECISIONES_TECNICAS_LOG.md` (el archivo de 1225 líneas que este reemplazó, movido sin editar) o en su propio ADR bajo `docs/adr/`. Una decisión técnica nueva se escribe como un ADR nuevo en `docs/adr/ADR-0NN-tema.md` más una fila acá — nunca como una entrada más del log archivado, ese ya no crece.

| Decisión | Fecha | Dónde está el detalle |
|---|---|---|
| Stack obligatorio: zod+react-hook-form, zustand, lucide-react, sonner (sin duplicar) | 25/08/2026 | Log, `[25/08/2026] — Utilidades Esenciales del Frontend` |
| Limpieza estructural: todo a `src/shared/`, alias `@/` (warning-only) | 28/08/2026 | Log, `[28/08/2026] — Limpieza estructural del FrontEnd...` |
| Relevamiento de inconsistencias entre los 9 módulos (solo registro) | 28/08/2026 | Log, `[28/08/2026] — Inconsistencias Encontradas Entre Módulos` |
| Primer uso real de zustand/lucide-react/sonner + Kanban de Logística reemplazado por tabla paginada | 28/08/2026 | Log, `[28/08/2026] — Primer Uso Real de zustand...` |
| Hallazgos de relevamiento pasan a norma de tooling/nomenclatura obligatoria | 28/08/2026 | Log, `[28/08/2026] — Cumplimiento Obligatorio de Tooling...` |
| Relación `logistics`↔`orders`: `Delivery.orderId` tipado (Opción A, confirmada retroactivamente) | 28/08/2026 | Log, `[28/08/2026] — Cierre: Relación logistics↔orders` |
| Feature "Productos Bajo Stock Mínimo" (inventory) | 28/08/2026 | Log, `[28/08/2026] — Productos Bajo Stock Mínimo` |
| Reconciliación con `origin/lean`: se mantiene el alias `@/`, se descarta el sistema de ADRs que traía esa rama en ese momento | 30/08/2026 | Log, `[30/08/2026] — Reconciliación con origin/lean` |
| Contexto de sesión y sucursal activa (infraestructura multi-tenant) | 01/09/2026 | Log, `[01/09/2026] — Contexto de sesión y sucursal activa` |
| Inventario multi-depósito: stock/mínimo por sucursal + `supplierId` tipado | 01/09/2026 | Log, `[01/09/2026] — Inventario multi-depósito...` |
| Contrato de datos paginado server-side, primera versión (`usePagedQuery`) | 01/09/2026 | Log, `[01/09/2026] — Contrato de datos paginado server-side` |
| Feature Clientes Morosos / deuda vencida | 01/09/2026 | Log, `[01/09/2026] — Clientes morosos / deuda vencida` |
| Correcciones de moneda y aging en Clientes Morosos (C1-C3) | 01/09/2026 | Log, `[01/09/2026] — Correcciones de moneda y aging...` |
| Módulo Compras: `OrdenDeCompra` como entidad top-level (O1-O10) | 01/09/2026 | Log, `[01/09/2026] — Módulo Compras...` |
| Regla de selectores estables en zustand (evita loop de render por referencia) | 02/09/2026 | Log, `[02/09/2026] — Regla de selectores estables en zustand` |
| "Generar OC" desde stock crítico + tab "Pendientes de Recepción" en Compras | 02/09/2026 | Log, `[02/09/2026] — "Generar OC" desde stock crítico...` |
| Rango de fecha, selector de sucursal y Exportar en los 6 listados ya migrados | 03/09/2026 | Log, `[03/09/2026] — Rango de fecha, Sucursal/Depósito y Exportar` |
| Contención de errores en dos niveles (Tanda 0 de escalabilidad) | 03/09/2026 | Log, `[03/09/2026] — Contención de errores en dos niveles` |
| Capa `api/` (dto/mapper/service) + `httpClient`, piloto `suppliers` (Tanda 1) | 03/09/2026 | Log, `[03/09/2026] — Capa api/ (dto/mapper/service) y httpClient` |
| Cache/dedupe/invalidación cruzada con TanStack Query en `usePagedQuery` (Tanda 2) | 04/09/2026 | Log, `[04/09/2026] — Cache, dedupe e invalidación cruzada...` |
| `httpClient` unificado + `useCachedQuery` (Tanda 2.5) | 04/09/2026 | Log, `[04/09/2026] — httpClient unificado + useCachedQuery` |
| Migración de `orders` a la capa `api/` (Tanda 3a) | 04/09/2026 | Log, `[04/09/2026] — Migración de orders (Pedidos)` |
| Migración de `cash` a la capa `api/` (Tanda 3b) | 04/09/2026 | Log, `[04/09/2026] — Migración de cash (Caja)` |
| Migración de 3 vistas de `settings` (Tanda 3c) | 04/09/2026 | Log, `[04/09/2026] — Migración de 3 vistas de settings` |
| Migración del Directorio de Clientes (Tanda 3d) | 04/09/2026 | Log, `[04/09/2026] — Migración del Directorio de Clientes` |
| Fundación de `shared/api/products/` + migración de Stock Actual (Tanda 3e) | 04/09/2026 | Log, `[04/09/2026] — Fundación de inventory...` |
| Migración de Movimientos e Historial del Producto, agrega `branchId` a ambos tipos (Tanda 3g) | 06/09/2026 | Log, `[06/09/2026] — Migra Movimientos e Historial del Producto` |
| Modelo de entrega parcial (remitos append-only, línea con cantidad entregada) | 07/09/2026 | `docs/adr/ADR-001-entrega-parcial.md` |
| Máquina de estados de la entrega/viaje | 07/09/2026 | `docs/adr/ADR-002-maquina-estados-entrega.md` |
| Mecanismo de "tiempo real" simulado (sin backend) | 07/09/2026 | `docs/adr/ADR-003-tiempo-real.md` |
| Contrato de exportación (Excel/CSV) server-side | 07/09/2026 | `docs/adr/ADR-004-exportacion.md` |
| Evidencia del rechazo de mercadería (upload de fotos/PDF) | 07/09/2026 | `docs/adr/ADR-005-evidencia-rechazo.md` |
| IDs tipados (branded types: `OrderId`, `BranchId`, etc.) | 07/09/2026 | `docs/adr/ADR-006-ids-tipados.md` |
| Alcance y ciclo de vida de las alertas del tablero | 07/09/2026 | `docs/adr/ADR-007-alertas.md` |
| Dinero y cantidades (módulo `Money`, centavos enteros) | 07/09/2026 | `docs/adr/ADR-008-dinero-cantidades.md` |
| Alcance del dashboard: empresa vs. sucursal, elegido por el usuario | 07/09/2026 | `docs/adr/ADR-009-alcance-dashboard.md` |
| Modelo logístico: 3 ejes de estado (comercial/logístico/financiero), jerarquía Viaje→Parada→Entrega→Línea, idempotencia, catálogo de motivos, logística inversa, POD — **Propuesto, sin aprobar** | 09/09/2026 | `docs/adr/ADR-010-modelo-logistico.md` |
| Viajes, capacidad multidimensional y motor de asignación por filtro — **Propuesto, sin aprobar** | 09/09/2026 | `docs/adr/ADR-011-viajes-y-asignacion.md` |
