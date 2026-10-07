# Verificación Tanda 18 — Estado Activo/Inactivo visible en el Directorio de clientes

**Fecha:** 2026-10-07. Tercera parte del hallazgo de la Tanda 16 (`AUDIT_2026-10-07_clientes-inactivos.md`, ALTO-1): "mostrar el estado en el listado de clientes". `VERIFICACION_TANDA_16.md` lo había dejado afuera de su alcance a propósito.

## Qué cambió

- `ClientDirectoryTable.tsx`: columna nueva **Activo** con un badge `Activo` (verde, `client-badge--success`) o `Inactivo` (rojo, `client-badge--danger`). Son clases que ya existían en `ClientsPage.css`, no se agregó CSS. El `colSpan` de la fila vacía pasa de 7 a 8.
- `ClientsPage.tsx#directoryExportColumns`: columna **Activo** con el mismo texto, así el archivo exportado coincide con lo que se ve en pantalla (ADR-004).

**Decisión (regla 2.9, menor):** el encabezado es "Activo" y no "Estado", porque el export ya tiene una columna "Estado" con el estado de cuenta corriente (`Al dia`/`Con Deuda`). Dos columnas "Estado" en el mismo archivo serían ambiguas. **No se agregó un filtro** por activo/inactivo en el Directorio: la tarea pedía *mostrar* el estado. Un filtro implica cambiar `ClientsQueryFilters` + URL + export, y no fue pedido.

## Gates

| Gate | Resultado |
|---|---|
| 1 `tsc -b` | exit 0 |
| 2 `eslint .` | 0 errores, 1 warning preexistente |
| 3 `vite build` | `✓ built in 1.42s` |
| 4 smoke | **no aplica**: la tanda no agrega lógica pura (es un ternario de presentación). Se volvieron a correr `tanda-17` y `tanda-14` como regresión: los dos pasan. |
| 5 conexión | no hay funciones nuevas exportadas |
| 6 autorrevisión | sin `any`/`as`. El export reusa la misma variable `directoryFilters` que el listado (sin cambios). |
| 8 arquitectura | sin cambios de estructura |

## Qué verificar en el navegador

1. `/clientes` → Directorio: los 30 clientes del seed muestran el badge verde **Activo**.
2. Dar de baja un cliente (editar → Ajustes → Cliente Inactivo → Guardar). **Esperado:** sin recargar, la fila muestra el badge rojo **Inactivo** (el `refetch()` del Directorio ya existía).
3. Exportar el Directorio (CSV y XLSX). **Esperado:** última columna "Activo", con "Inactivo" en el cliente del paso 2 y "Activo" en el resto.
4. Tabla angosta: confirmar que la columna nueva no rompe el layout de `client-table-wrapper` en un ancho de laptop (~1366px).

## Qué NO se verificó

- Nada de esto se abrió en un navegador.
- Cuentas Corrientes y Clientes Morosos (`ClientAccountsTable`/`ClientOverdueTable`) no muestran el estado de alta. No fue pedido: la tarea dice "el listado de clientes", que es el Directorio.
