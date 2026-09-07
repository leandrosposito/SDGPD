# Verificación Tanda 4 — Contexto de sucursal + estado de listados en la URL

**Fecha de implementación:** 2026-09-07. Todo lo de acá abajo requiere el navegador — no se ejecutó en esta sesión (regla del prompt maestro: la verificación funcional la hace Leandro).

## Qué cambió

- `BranchSelector.tsx`: ahora maneja explícitamente 0 sucursales (estado no interactivo, "Sin sucursales disponibles") y 1 sucursal (estático, sin dropdown clickeable).
- `usePagedQuery.ts`: `page` y `sort` ahora pueden ser controlados desde afuera (`options.page`/`onPageChange`, `options.sort`/`onSortChange`), preservando el modo no controlado para cualquier consumidor que no migre.
- `useUrlListState.ts` (nuevo, `shared/hooks/`): sincroniza página, orden y filtros propios de un listado con los `search params` de la URL.
- Los 15 listados con `usePagedQuery` migraron a `useUrlListState` para página/orden/búsqueda/filtros.

## 1. Selector de sucursal — 0 / 1 / N sucursales

1. Con el mock actual (3 sucursales activas): abrir la app, confirmar que el selector en el header muestra un dropdown con las 3 opciones, funciona con teclado (flecha abajo para abrir, Escape para cerrar) y mouse.
2. **Simular 1 sola sucursal** (requiere editar temporalmente `src/data/mock/session.mock.ts` o el archivo que define `session.branches`, dejando un solo elemento activo, y revertir el cambio después de probar — no hay forma de probarlo sin tocar el mock, ya que no hay ningún flujo de UI que reduzca las sucursales de una empresa real): confirmar que el selector se ve como una etiqueta estática (empresa + sucursal), sin flecha de dropdown ni posibilidad de click.
3. **Simular 0 sucursales** (mismo mecanismo que el punto 2, con `branches: []`): confirmar que se ve "Sin sucursales disponibles", sin lanzar ningún error en consola ni romper el resto del layout.
4. Revertir los cambios del mock después de probar los puntos 2 y 3.

## 2. Cambio de sucursal no muestra datos de la anterior (criterio de aceptación, ya cubierto por mecanismo preexistente — reverificar que sigue andando)

Para cada uno de los 5 listados de alcance sucursal (Bajo Stock Mínimo, Movimientos, Historial de Producto, Stock Actual — las 4 tabs de Inventario — y Logística/Entregas):

5. Anotar un dato visible de la sucursal actual (ej. el primer SKU de la tabla).
6. Cambiar de sucursal en el selector del header.
7. Confirmar que la tabla NO muestra ni por un frame el dato anotado en el paso 5 antes de refrescar con los datos de la nueva sucursal (puede verse un estado de carga/skeleton, pero nunca el dato viejo bajo el rótulo de la sucursal nueva).

## 3. Estado en la URL — por cada listado, confirmar que la URL cambia y que pegarla reproduce el estado

Repetir para cada uno de los 15 listados (usar la tabla de mapeo de abajo para saber qué parámetros esperar):

8. Cambiar de página (si el listado tiene más de una página de datos) → confirmar que aparece `?<prefijo_si_aplica>page=N` en la URL.
9. Si el listado tiene búsqueda: tipear algo, esperar el debounce (300ms), confirmar que aparece `?<prefijo>q=...` en la URL.
10. Si el listado tiene orden por columna (Bajo Stock Mínimo, Movimientos, Historial de Producto, Proveedores): hacer click en un header ordenable, confirmar `?<prefijo>sort=campo:direccion` en la URL.
11. Si el listado tiene otros filtros (estado, categoría, rango de fecha, sucursal-filtro en Compras): cambiarlos y confirmar que aparecen en la URL con el nombre de parámetro correspondiente.
12. **Copiar la URL completa, abrir una pestaña nueva (o refrescar con F5) y pegarla**: confirmar que el listado se ve EXACTAMENTE igual (misma página, mismo orden, mismos filtros/búsqueda) sin tener que volver a tocar nada.
13. Volver a página 1 manualmente y confirmar que el parámetro `page` desaparece de la URL (page=1 es el default, no se persiste explícito).

### Tabla de mapeo listado → prefijo de URL

| Listado | Prefijo | Campos esperados |
|---|---|---|
| Caja (movimientos) | (ninguno) | `page` |
| Directorio de Clientes | (ninguno) | `page`, `q`, `zone`, `seller`, `status`, `tab` |
| Cuentas Corrientes (tab de Clientes) | `acc_` | `acc_page`, `acc_preset`, `acc_from`, `acc_to` |
| Clientes Morosos (tab de Clientes) | `over_` | `over_page`, `over_preset`, `over_from`, `over_to`, `over_bucket` |
| Compras — Listado General | `oc_` | `oc_page`, `oc_q`, `oc_supplier`, `oc_status`, `oc_branch`, `oc_preset`, `oc_from`, `oc_to`, `oc_tab` |
| Compras — Pendientes de Recepción | `rec_` | `rec_page`, `rec_preset`, `rec_from`, `rec_to` |
| Inventario — Bajo Stock Mínimo | `bajo_` | `bajo_page`, `bajo_sort`, `bajo_q` |
| Inventario — Movimientos | `mov_` | `mov_page`, `mov_sort` |
| Inventario — Historial de Producto | `hist_` | `hist_page`, `hist_sort`, `hist_q` |
| Inventario — Stock Actual | `stock_` | `stock_page`, `stock_q` |
| Logística / Entregas | (ninguno) | `page`, `status`, `preset`, `from`, `to` |
| Pedidos | (ninguno) | `page`, `q`, `status`, `seller`, `payment`, `from`, `to` |
| Settings — Suscripción (Historial de Cobros) | `sub_` | `sub_page` |
| Settings — Usuarios | `usr_` | `usr_page` |
| Proveedores | (ninguno) | `page`, `sort`, `q`, `category` |

## 4. Convivencia con el deep-link existente de Compras

14. Desde Proveedores, click en "Nueva OC" con un proveedor seleccionado → confirmar que sigue abriendo el modal en Compras con ese proveedor preseleccionado (mecanismo `?proveedor=`, sin relación con los params nuevos `oc_*`/`rec_*`).
15. Desde Inventario → Bajo Stock Mínimo, click en "Generar OC" → confirmar que sigue abriendo el modal en Compras con la línea precargada (mecanismo `?producto=&sucursal=`).
16. Confirmar que ninguno de los dos flujos deja basura en la URL después de abrir el modal (los params `proveedor`/`producto`/`sucursal` deben desaparecer, como ya hacían antes de esta tanda).

## 5. Regresión general

17. Verificar que ninguna mutación (crear pedido, crear cliente, cambiar estado de OC, etc.) se rompió — deberían seguir refrescando su listado como antes.
18. Verificar que los 6 `ExportButton` existentes (Proveedores, Cuentas Corrientes, Clientes Morosos, Compras, Bajo Stock Mínimo, Entregas) siguen exportando con los filtros vigentes (ahora leídos de la URL en vez de un `useState` local — el valor visible en pantalla debe ser el mismo que antes).

## No cubierto por esta tanda (fuera de alcance, documentado en el reporte final)

- Code-splitting por ruta y el peso del bundle (A8) — sin cambios.
- Tandas 3f/3g (Reposición/Movimientos-Historial) — 3g ya estaba migrada antes de esta corrida; 3f (Reposición) sigue sin service ni paginar, fuera de esta corrida por decisión explícita del prompt maestro.
