# Verificación funcional manual — Tanda 3f (Reposición)

**Quién ejecuta esto:** vos, en el navegador. No requiere leer código — cada punto dice
exactamente qué hacer y qué mirar.

**Qué cubre:** la migración de la tab "Reposición" (`TabPurchases.tsx`) de `InventoryPage.tsx`,
de recibir el array completo de sugerencias por props (filtrado en cliente por sucursal
activa, sin paginar) a autoconsultarse con `usePagedQuery` + `purchase-suggestions.service.ts`.
Cierra la última tanda de migración de escalabilidad que quedaba pendiente (era el único
listado de datos reales de toda la app sin service ni paginación server-side).

**Lo que NO cambió:** el flujo de "Generar OC" (resolución del proveedor real, invalidación
cruzada hacia Compras) — sigue exactamente igual que antes, solo cambió de dónde sale la
lista de sugerencias.

**Servidor de desarrollo:** hacé **hard refresh** (Ctrl+Shift+R) antes de empezar.

---

## Sección A — Carga, orden y paginado

### A1. Reposición carga y pagina

- Andá a **Inventario** (`/inventario`) → tab **"Reposición"**.
- **Qué deberías ver:** la tabla carga con las sugerencias de la sucursal activa, ordenadas
  por Stock Actual (de menor a mayor — las más urgentes primero).
- Si hay más de una página, probá los controles de `<Pagination>` de abajo.
- **Si no pasa esto:** si la tabla no carga o no aparece paginación con suficientes filas,
  revisá la consola por errores.

### A2. Ordenar por columna

- Hacé click en los encabezados **"Producto"**, **"Stock Actual"**, **"A Comprar"** y
  **"Costo Est."**.
- **Qué deberías ver:** la lista se reordena en cada click (aparece una flecha ▲/▼ en el
  encabezado activo, cambia de dirección al hacer click de nuevo en la misma columna).
- **Si no pasa esto:** revisá la consola por errores.

---

## Sección B — Filtrado por sucursal (lo nuevo de esta tanda)

### B1. Cambiar de sucursal cambia las sugerencias

- Con "Reposición" abierto, anotá los SKU que ves.
- Cambiá de sucursal desde el selector del header (probá las 3 sucursales activas).
- **Qué deberías ver:** la lista cambia — otras sugerencias, no las mismas reordenadas —
  y no debería verse ni por un frame la lista de la sucursal anterior mientras carga la
  nueva.
- **Si no pasa esto:** avisame, sería un bug real (el filtro de sucursal no se estaría
  aplicando, o quedaría un frame con datos viejos).

### B2. Los registros de una sucursal no aparecen en otra

- Anotá los SKU que ves en **Sucursal Centro**.
- Cambiá a **Sucursal Norte** y después a **Sucursal Sur**.
- **Qué deberías ver:** ninguna sugerencia de Sucursal Centro reaparece en las otras dos.
- **Si no pasa esto:** avisame.

---

## Sección C — "Generar OC" sigue funcionando igual

### C1. Generar una orden de compra desde una sugerencia

- Elegí una sugerencia cuyo producto tenga un proveedor real asignado y hacé click en
  **"Generar OC"**.
- **Qué deberías ver:** un toast de éxito ("Se creó la orden... " o "Se agregó..."), con
  un botón "Ver en Compras" que navega a `/compras` mostrando la nueva orden (o la línea
  agregada a un borrador existente para ese proveedor).
- **Si no pasa esto:** revisá la consola por errores.

### C2. Producto sin proveedor válido se rechaza con mensaje claro

- Si hay algún producto en la lista sin proveedor real asignado (o podés forzarlo editando
  un producto en "Stock Actual" para sacarle el proveedor), hacé click en "Generar OC" para
  esa sugerencia.
- **Qué deberías ver:** un toast de error explicando que el producto no tiene proveedor
  válido — no debería crearse ninguna orden.

---

## Tabla de resultados

| Punto | Resultado | Notas |
|---|---|---|
| A1. Reposición carga y pagina | No ejecutado | Checklist nuevo, pendiente de correr en navegador. |
| A2. Ordenar por columna | No ejecutado | — |
| B1. Cambiar de sucursal cambia las sugerencias | No ejecutado | **Este es el punto que prueba la migración de esta tanda** — verificado por `scripts/smoke/tanda-3f.smoke.mjs` contra datos de prueba (filtrado disjunto por sucursal), pero NO en el navegador todavía. |
| B2. Los registros de una sucursal no aparecen en otra | No ejecutado | Mismo motivo que B1. |
| C1. Generar OC sigue funcionando | No ejecutado | El código de este flujo no se tocó, solo cambió de dónde recibe `data` — riesgo bajo, pero sin confirmar en los hechos. |
| C2. Rechazo por proveedor inválido | No ejecutado | Ídem C1. |
