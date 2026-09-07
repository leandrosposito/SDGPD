# Verificación Tanda 6 — Exportación server-side (job asíncrono)

**Fecha:** 2026-09-07. Implementa ADR-004. Checklist para Leandro en navegador — nada de esto se verificó automáticamente más allá de `tsc`/`lint`/`build`/smoke script (ver `scripts/smoke/tanda-6.smoke.mjs`).

## Qué cambió

El botón "Exportar" (`ExportButton`) ya no arma el CSV/XLSX en el propio navegador de forma síncrona — ahora crea un "job" simulado (`createExportJob`), lo consulta cada ~250ms (`getExportJobStatus`) mientras avanza por `pendiente` → `procesando` (con % de progreso) → `listo` (o `vacío`/`error`), y recién ahí dispara la descarga real. El archivo en sí se sigue generando con `xlsx` (SheetJS, sin dependencia nueva) pero ahora en un módulo aparte (`buildExportFile.ts`) que simula ser "el servidor".

**Alcance de esta tanda:** se migró la arquitectura y los **7 listados que ya tenían exportación** (ninguno nuevo — ver sección "Pendiente" abajo).

## Pasos de verificación

Para cada uno de los 7 listados con `ExportButton`, repetir:

1. **Proveedores** (`/proveedores`) — botón "Exportar" en el header.
2. **Cuentas Corrientes de Clientes** (`/clientes`, tab correspondiente) — `ClientAccountsTable`.
3. **Clientes Morosos** (`/clientes`, tab de morosos) — `ClientOverdueTable`.
4. **Compras — listado principal** (`/compras`).
5. **Compras — Recepción Pendiente** (`/compras`, tab correspondiente) — `TabPendingReceipt`.
6. **Inventario — Bajo Stock Mínimo** (`/inventario`, tab correspondiente) — `TabLowStock`.
7. **Logística — Entregas** (`/logistica`).

Para cada uno:

- [ ] Click en "Exportar" → elegir "Excel (.xlsx)". El botón debe deshabilitarse y mostrar texto cambiante ("Preparando... 0%" → "Exportando... 30%" → "60%" → "90%") durante ~2 segundos, sin poder hacer un segundo click mientras tanto.
- [ ] Al terminar, debe descargarse un archivo `.xlsx` real (revisar la carpeta de descargas del navegador) y aparecer un toast de éxito con el nombre del archivo y la cantidad de filas.
- [ ] Abrir el archivo descargado y confirmar que tiene datos reales, coincidentes con lo que se ve en pantalla con los filtros vigentes.
- [ ] Repetir con "CSV (.csv)" — mismo flujo, el archivo debe abrir bien en Excel (acentos/ñ correctos, gracias al BOM UTF-8).
- [ ] Aplicar un filtro/búsqueda en el listado (ej. buscar un texto que no exista) para que el resultado quede vacío, y exportar — debe aparecer un toast de error ("No hay datos para exportar con los filtros actuales."), **sin** intentar descargar ningún archivo.
- [ ] Confirmar que el archivo exportado refleja el MISMO filtro/orden/búsqueda que el listado tiene aplicado en ese momento en la URL (cambiar un filtro, exportar, y verificar que el archivo trae ese subconjunto, no todo).

## Caso de fallo del job (difícil de forzar sin backend real)

No hay una forma sencilla de forzar que un job termine en `error` desde la UI (el "servidor" simulado no falla nunca salvo que `fetchRows` interno lance, lo cual no ocurre con datos válidos del mock). El smoke script sí ejercita este camino con un `fetchRows` que falla a propósito — se considera cubierto ahí, no en navegador.

## Pendiente (documentado, no implementado en esta tanda)

Los siguientes ~9 listados **no tienen exportación hoy y no se les agregó en esta tanda** — la arquitectura ya está lista (`ExportButton`/`useExportJob` genéricos) para cuando se decida agregarles un `export*` propio en cada service:

- Caja (`CashPage`)
- Directorio de Clientes (`ClientsPage`)
- Inventario — Movimientos (`TabMovements`)
- Inventario — Historial de Producto (`TabProductHistory`)
- Inventario — Stock Actual (`TabStockCurrent`)
- Pedidos (`OrdersPage`)
- Settings — Suscripción/Facturas (`TabSubscription`)
- Settings — Usuarios (`TabUsersRoles`)

Agregarles export es, a partir de ahora, solo escribir un `export*` en su service (mismo patrón que los 6 existentes) — el `ExportButton`/`useExportJob` no necesitan ningún cambio para soportarlos.
