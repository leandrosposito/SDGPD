# Verificación Tanda C1 — ExportButton en Caja, Directorio de Clientes, Movimientos, Historial de Producto, Stock Actual

**Fecha:** 2026-09-07. Sesión "conexión huérfanas / export / 3f / 3g" (`docs/PROTOCOLO.md`). Checklist para Leandro en navegador — nada de esto se verificó automáticamente más allá de `tsc`/`lint`/`build`/los smoke scripts existentes reusados (`tanda-6.smoke.mjs`, arquitectura de export ya cubierta ahí; no hace falta un smoke nuevo porque esta tanda solo reusa lógica de filtro/orden ya testeada en cada dominio).

## Qué cambió

5 listados que no tenían `ExportButton` lo tienen ahora, cada uno con una función `export<Dominio>` nueva en su service que reusa (no duplica) el mismo filtro/orden interno que ya usa su `get*Page`:

| Listado | Función nueva | Archivo del componente |
|---|---|---|
| Caja | `exportCashTransactions` | `modules/cash/CashPage.tsx` |
| Directorio de Clientes | `exportClients` | `modules/clients/ClientsPage.tsx` (vía `ClientActionBar`, que reemplaza el botón "Exportar a Excel" decorativo que ya existía sin `onClick`) |
| Movimientos (Inventario) | `exportMovements` | `modules/inventory/components/TabMovements.tsx` |
| Historial de Producto | `exportProductHistory` | `modules/inventory/components/TabProductHistory.tsx` |
| Stock Actual | `exportStockedProducts` | `modules/inventory/components/TabStockCurrent.tsx` |

## Pasos de verificación

Para cada uno de los 5:

1. **Caja** (`/caja`) — botón "Exportar" en el header, al lado de "Cierre de Caja"/"+ Nuevo Movimiento".
2. **Directorio de Clientes** (`/clientes`, tab Directorio) — el botón "Exportar a Excel" que antes no hacía nada ahora exporta de verdad.
3. **Inventario — Movimientos** (`/inventario`, tab Movimientos) — botón nuevo al lado de "Mostrando movimientos de \<sucursal\>".
4. **Inventario — Historial de Producto** (`/inventario`, tab Historial) — botón nuevo en el toolbar, al lado del buscador.
5. **Inventario — Stock Actual** (`/inventario`, tab Stock Actual) — botón nuevo al lado del buscador de productos.

Para cada uno:

- [ ] Click en "Exportar" → "Excel (.xlsx)". Progreso visible (mismo flujo de job asíncrono de Tanda 6), descarga real al terminar.
- [ ] Repetir con "CSV (.csv)".
- [ ] Abrir el archivo y confirmar que las columnas y los datos coinciden con lo que se ve en pantalla.
- [ ] **Caja y Directorio de Clientes:** no tienen filtro de búsqueda propio server-side hoy (Caja nunca tuvo ninguno; Directorio sí tiene búsqueda/zona/vendedor/estado) — para Directorio, aplicar un filtro y confirmar que el archivo exportado refleja SOLO ese subconjunto, no el directorio completo.
- [ ] **Movimientos:** cambiar de sucursal activa y confirmar que el export solo trae movimientos de la sucursal actual (esta tab no tiene buscador, decisión ya documentada — no confundir con un bug).
- [ ] **Historial de Producto:** aplicar la búsqueda por SKU/nombre y confirmar que el export refleja ese filtro.
- [ ] **Stock Actual:** aplicar la búsqueda y confirmar que el export refleja ese filtro, y que cambiar de sucursal cambia lo que se exporta.
- [ ] Con un filtro que no matchee ningún resultado, exportar — debe aparecer el toast de "sin datos", sin descargar nada (mismo comportamiento ya verificado en Tanda 6 para los otros 7 listados).

## Pendiente (fuera de esta tanda, cubierto por la Tanda C2 en paralelo)

`OrdersPage`, `TabSubscription`, `TabUsersRoles` y `TabPurchases` (Reposición) — otro fork de la misma sesión los cubre, ver `docs/VERIFICACION_TANDA_C2.md` si ya existe al momento de leer esto.
