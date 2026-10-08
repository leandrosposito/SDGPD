# ADR-BE-011 — Exportación, alertas, tablero y analítica

**Estado:** Aceptado. **Fecha:** 2026-10-07. **Resuelve:** decisiones #5, #21 y #23 de [`08_DECISIONES_ABIERTAS.md`](../../../FrontEnd/docs/historial/auditorias/backend/08_DECISIONES_ABIERTAS.md).

**Enmienda a ADRs del frontend:** [ADR-004](../../../FrontEnd/docs/adr/ADR-004-exportacion.md), [ADR-007](../../../FrontEnd/docs/adr/ADR-007-alertas.md), [ADR-009](../../../FrontEnd/docs/adr/ADR-009-alcance-dashboard.md).

## Contexto

- **Exportación (B3):** el contrato de ADR-004 no tiene contrato HTTP.
  - El job corre en el navegador (`FrontEnd/src/shared/api/exports/exportJobs.ts:82-131`).
  - Los 15 `GET …/export` mandan hasta 10.000 filas al cliente.
  - Las columnas son funciones del cliente (`exportTypes.ts:9-12`; 01 C-1).
- **Alertas (A15, parte de alertas):** nada las genera (es el seed estático de 15) y `leida` es global (`alert.types.ts:23`, `alerts.service.ts:75-84`). ADR-007 las pide por usuario.
- **Tablero (M16):** conviven dos fuentes:
  - `fetchDashboardData` (`services/mock/dashboard.service.ts:28`), un dataset estático que alimenta `DashboardPage.tsx:16-71`.
  - `getDashboardAggregates` (ADR-009), que alimenta `DashboardAggregatesSection.tsx`.
  - Las 4 funciones sin `empresaId` del mismo archivo (**A1**) son código muerto.
- **Analítica (A20):** lee `analytics.data.ts` directo, sin contrato (`AnalyticsPage.tsx:2`).

## Decisión

### Exportación
- **Job en el servidor** (ADR-004).
- El cliente manda **recurso, filtros, orden, formato y columnas por nombre**, contra una lista blanca por recurso definida en `contracts`.
- El servidor arma el archivo y lo entrega por **URL firmada con vencimiento** (ver §Storage).

### Storage (resolución de la objeción 1)
- **Una interfaz única de almacenamiento de archivos** en el backend, con dos implementaciones:
  - **Desarrollo:** disco local, con **URLs firmadas por el propio backend** (HMAC con vencimiento).
  - **Producción:** **object storage compatible con S3**, que pasa a ser infraestructura obligatoria **recién desde la primera tanda que guarda archivos** (uploads de BE-7). ADR-BE-001 §Decisión 2 quedó corregido con ese límite.
- **Los archivos no se guardan en Postgres.** Ni `bytea` ni large objects.
- Vale tanto para las exportaciones de este ADR como para la evidencia de ADR-005 y los uploads de POD (BE-7).

### Alertas
- Las genera un **job programado e idempotente**.
- **"Leída" es por usuario**, en tabla propia (ADR-007).

### Tablero y analítica
- **Una sola fuente, la de ADR-009. `fetchDashboardData` se retira.**
- La analítica se define como **endpoints de agregados**.
- **Todo agregado se calcula en SQL.**

## Alternativas descartadas (08 #5, #21, #23)

- **#5 A. Columnas fijas definidas solo por el servidor:** pierde la elección de columnas por pantalla que existe hoy (`ClientsPage.tsx:59-74`).
- **#5 C. Descarga síncrona:** ADR-004 la descartó (alternativa 2): un export grande supera cualquier timeout razonable.
- **#21 Generación por evento en cada comando:** acopla cada comando al motor de alertas. Los vencimientos dependen del paso del tiempo, no de un comando.
- **#23 Mantener los dos tableros:** dos números distintos para la misma pregunta.

## Consecuencias para el backend

- **Exportación:**
  - `POST /exports` → `202 {jobId}`. `GET /exports/{jobId}` → `{status, progress, downloadUrl?, truncated}`.
  - Tabla `export_jobs` en Postgres, procesada por un worker interno que la toma con `FOR UPDATE SKIP LOCKED` (ADR-BE-001: sin colas externas).
  - Cada recurso exportable declara en `contracts` sus columnas por nombre y cómo se calcula cada una.
  - El export reutiliza **la misma consulta** que el listado (filtros y orden de la lista blanca, ADR-BE-004).
- **Alertas:**
  - Job programado con advisory lock (una sola instancia), que **inserta solo si no existe** la alerta para la misma entidad y condición: idempotencia por clave natural de alerta.
  - `alert_reads (empresa_id, alert_id, user_id, read_at)`.
  - El resumen y el listado cruzan con las lecturas del usuario de la sesión.
- **Tablero y analítica:** endpoints `GET /dashboard/...` y `GET /analytics/...` que devuelven agregados calculados con `GROUP BY`, con el alcance de sucursal de ADR-009 (enmendado por ADR-BE-007: sucursal de origen del pedido).

## Consecuencias para el frontend

- **Exportación:**
  - `useExportJob`/`createExportJob` dejan de llamar a `fetchRows` y a `buildExportFile`: piden `POST /exports` y hacen polling del job (ADR-003).
  - `ExportColumn<T>.accessor` (función) se reemplaza por **nombres de columna** de la lista blanca.
  - `xlsx` deja de usarse en el navegador (`buildExportFile.ts`).
  - Los 15 `export*` de los services desaparecen.
- **Alertas:** `AlertsBell` sigue igual (summary + cursor). `markAlertAsRead` pasa a ser por usuario sin cambiar su firma.
- **Tablero:** los 4 widgets de `DashboardPage` (KPIs, ventas, top productos, últimos pedidos) pasan a consumir endpoints de agregados (ver objeción 2). `useDashboard` y `services/mock/dashboard.service.ts` se retiran (junto con las 4 funciones de A1).
- **Analítica:** `AnalyticsPage` pasa a consumir los endpoints de analítica y deja de importar `analytics.data.ts`.

## Hallazgos que cierra

| Hallazgo | Qué era |
|---|---|
| **B3** | exportación sin contrato HTTP |
| **A1** | funciones muertas sin `empresaId`: se retiran con `dashboard.service.ts` |
| **A15** (parte de alertas) | `leida` global; nada genera alertas |
| **A20** | analítica sin contrato |
| **M16** | dos fuentes de tablero |
| **M18** (en analytics) | SKUs huérfanos: dejan de existir al reemplazarse el dataset estático por agregados reales |

## Sub-decisiones (aprobadas 2026-10-08)

1. **Formatos de exportación:** `csv` y `xlsx`, los mismos que hoy (`ExportFormat`). La librería de XLSX del servidor es una dependencia nueva a aprobar.
2. **Vida del archivo exportado:** el `downloadUrl` expira a los **15 minutos**, y el archivo se borra a las **24 horas**.
3. **Tope:** se mantiene `MAX_EXPORT_ROWS` = 10.000 (`pagination.types.ts:74`) y `truncated` en el estado del job.
4. **Frecuencia del job de alertas:** cada 15 minutos para vencimientos y demoras. La clave natural es `(tipo, entidad, día)`.
5. **Retención de alertas:** no se borran (ADR-007). Las leídas de más de 90 días se excluyen del listado por defecto, pero se pueden consultar.
6. **Endpoints de los 4 widgets del tablero viejo:** `GET /dashboard/kpis`, `/dashboard/sales-series`, `/dashboard/top-products` y `/dashboard/recent-orders` (este último, paginado con tope 10), todos con el alcance de sucursal de ADR-009.

## Objeciones

1. **"URL prefirmada" supone un object storage**, y ADR-BE-001 dice que **Postgres es la única infraestructura obligatoria**. ADR-005 (evidencias) ya asumía lo mismo (`docs/adr/ADR-005-evidencia-rechazo.md`: "Subida directa a storage con URL prefirmada"). Con la decisión tal cual, o se agrega un storage (contra ADR-BE-001), o la "URL prefirmada" la firma el propio backend (token HMAC con vencimiento) y el archivo se guarda en Postgres (`bytea` o large object). Esa segunda vía no es una URL prefirmada de storage en sentido estricto. No lo resuelvo.

   **Resolución (2026-10-08):** **una interfaz única de almacenamiento de archivos** en el backend. **Desarrollo:** disco local, con URLs firmadas por el propio backend (HMAC con vencimiento). **Producción:** object storage compatible con S3, que pasa a ser infraestructura obligatoria **recién desde la primera tanda que guarda archivos** (uploads de BE-7). **Los archivos no se guardan en Postgres.** El principio de ADR-BE-001 ("Postgres es la única infraestructura obligatoria") quedó corregido para decir **hasta qué tanda** vale: hasta BE-6 inclusive. Escrito en la sección §Storage.
2. **Retirar `fetchDashboardData` deja sin fuente a 4 widgets.** `DashboardPage.tsx:47,56,62,71` (KPIs, ventas, top productos, últimos pedidos) se alimentan **solo** de `fetchDashboardData`. Los agregados de ADR-009 (`getDashboardAggregates`) cubren otras tarjetas (ventas por zona, pedidos por estado, cuentas por cobrar). "Una sola fuente, la de ADR-009" requiere que ADR-009 se **extienda** a esos 4 widgets (sub-decisión 6). Si no, el tablero pierde la mitad de su contenido.

   **Resolución (2026-10-08):** **resuelto por la sub-decisión 6**, aprobada: ADR-009 se extiende a esos 4 endpoints (`GET /dashboard/kpis`, `/dashboard/sales-series`, `/dashboard/top-products`, `/dashboard/recent-orders`), todos con su alcance de sucursal. La línea quedó agregada a la **sección de enmienda de ADR-009**.
