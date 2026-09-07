# ADR-004 — Contrato de exportación (Excel/CSV)

**Estado:** Decidido. **Fecha:** 2026-09-07.

## Problema

El prompt maestro exige que ningún export se arme en el navegador (Sección 7, regla de escalabilidad) — el proyecto ya tiene 6 `export*` server-side en el mock (`AUDIT_3_PAGINACION_VOLUMEN.md`, "qué está bien": ya respetan `MAX_EXPORT_ROWS=10.000`), pero no hay un contrato único ni un componente compartido — cada uno se invoca distinto. Tanda 6 necesita generalizar esto a todos los listados con un solo `ExportButton`.

## Opción elegida

- **El archivo lo genera el servidor, siempre, sin excepciones.** El cliente nunca arma un CSV ni un XLSX en memoria del navegador.
- **Contrato de dos pasos:**
  1. `POST /{recurso}/export` con **exactamente los mismos filtros del listado** (los que ya viajan a `get{Recurso}Page`, leídos de la URL desde Tanda 4) + `formato: 'csv' | 'xlsx'` → responde `202 { jobId }`.
  2. `GET /exports/{jobId}` → `{ estado: 'pendiente' | 'procesando' | 'listo' | 'error', progreso?: number, downloadUrl? }`. El cliente hace **polling** de este job (reutilizando `useLiveQuery`/el mismo criterio de ADR-003, con un intervalo más corto mientras el job está en curso) y abre `downloadUrl` al terminar.
- **El adaptador mock simula el job de verdad** — demora artificial, estados intermedios (`pendiente` → `procesando` → `listo`), para que el flujo de UI (botón deshabilitado, progreso, habilitar descarga) quede terminado y probado, no solo maquetado.
- **Un único `ExportButton` + hook compartido** (`useExportJob` o similar) para toda la app — ninguna pantalla reimplementa su propio botón de exportar.

## Alternativas descartadas

1. **El cliente arma el archivo con una librería (`xlsx`, `papaparse`) sobre los datos ya traídos a la página.** Descartada explícitamente por la regla de escalabilidad del prompt maestro — traer 50.000 filas al navegador para generar un archivo es exactamente el anti-patrón a evitar, y ya se identificó en A3 que los exports existentes hacen lo correcto (recortar server-side); generalizar el patrón incorrecto sería un retroceso.
2. **Descarga síncrona (`GET /{recurso}/export` devuelve el archivo directo, sin job).** Descartada porque un export de un dataset grande puede tardar más que un timeout HTTP razonable — el patrón asíncrono con job es el que escala sin importar el tamaño del resultado, y es el mismo patrón que cualquier backend real de este tipo ya usa.
3. **Un `ExportButton` por pantalla, cada uno con su propia lógica de polling.** Descartada por la regla explícita del prompt maestro ("un único `ExportButton` + hook compartido, no una implementación por pantalla") y porque ya hay 6 implementaciones de exportación en el mock sin un patrón de UI compartido — es exactamente la duplicación que esta tanda busca eliminar.

## Qué se rompe si se cambia después

- Si se vuelve a un export síncrono sin job, hay que rediseñar el `ExportButton`/hook compartido desde cero (pierde sentido el estado de "progreso" y el polling) — mejor no migrar a esto salvo que el backend real garantice que todo export es instantáneo, algo poco probable a escala.
- Si un export nuevo no reutiliza `ExportButton`/el hook compartido, se reintroduce la fragmentación de UI que este ADR busca evitar y cualquier cambio futuro al flujo (ej. agregar un nuevo formato) exige tocar N implementaciones en vez de una.
- Si los filtros del export dejan de ser exactamente los mismos que el listado (ej. se recalculan por separado), el archivo exportado puede no coincidir con lo que el usuario ve en pantalla — bug de confianza difícil de detectar en QA.
