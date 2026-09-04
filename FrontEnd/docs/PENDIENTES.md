# Pendientes

Inventario de deuda técnica e ítems abiertos detectados hasta la fecha. Cada ítem
fue confirmado contra el código real (no es una lista especulativa) — donde la
verificación mostró que el problema no existe o ya no aplica, queda marcado como
tal en vez de listado como pendiente.

---

## Vigentes

### 1. Edición de proveedor: falta el disparador, no la lógica — Severidad: Media

No existe ningún botón "Editar" en la UI de `suppliers` — ni en `SuppliersTable.tsx`
ni en `SupplierDetailPanel.tsx` (que hoy solo expone "Nueva OC" en sus acciones de
header). Confirmado con `grep` de "Editar/onEdit/handleEdit" en todo el módulo: el
único match es el título condicional del modal.

La lógica de edición, sin embargo, **ya está completa** en
`SupplierFormModal.tsx`: precarga los campos desde la prop `supplier` (líneas
26-37), cambia el título a "Editar Proveedor" cuando `supplier` no es null (línea
64), y llama a `onSave(input, supplier?.id)` (línea 51) — `SuppliersPage.tsx`
(`handleSaveSupplier`) ya soporta el update. Falta únicamente un botón que abra el
modal con un `supplier` no-nulo. Funcionalidad que nunca existió — no es una
regresión de la migración a la capa `api/` (Tanda 1), ya documentado así en
`VERIFICACION_TANDA_0_1.md`, punto 11.

### 2. Filtros de zona/vendedor/estado en `ClientAccountsTable` — no aplica, decisión de alcance ya documentada

Verificado: esos filtros **nunca existieron** en `ClientAccountsTable` (git log del
archivo solo tiene 4 commits, todos posteriores a su migración a `usePagedQuery`).
El propio código lo deja explícito en un comentario
(`ClientAccountsTable.tsx:24-27`): el filtro de zona/vendedor/estado del header
superior aplica solo al Directorio de Clientes, fuera de alcance de la tarea que
paginó Cuentas Corrientes — no se agregaron al contrato paginado a propósito. No
es deuda oculta ni algo que se haya perdido en un commit; se deja registrado acá
solo para que quede visible como una posible mejora futura si se decide unificar
el filtro entre ambas vistas.

### 3. `modules/compras` sigue en español — Severidad: Baja (consistencia, cosmético)

Confirmado: la carpeta sigue siendo `modules/compras` (`ComprasPage.tsx`,
`purchaseOrderLabels.ts`, etc.), no renombrada a `purchases` ni ningún equivalente
en inglés. El resto de los módulos de negocio usan nombres en inglés
(`suppliers`, `orders`, `inventory`, `logistics`, `cash`, `clients`). No rompe
nada — es una inconsistencia de nomenclatura, no un bug.

### 4. Archivos `.docx`/`.pdf` trackeados en `Documentacion/` pese al `.gitignore` — Severidad: Baja

**Corrección de conteo:** son **4** archivos, no 45 — verificado con
`git ls-files Documentacion/ | grep -E '\.(docx|pdf)$'`:
- `Documentacion/01. Product Vision SDGPD.docx` / `.pdf`
- `Documentacion/Product Vision SDGPD.docx` / `.pdf`

Causa confirmada: los 4 archivos se agregaron en el commit `4d1e8a2` (25/08/2026);
la regla `Documentacion/**/*.docx` / `**/*.pdf` en `.gitignore` (líneas 6-7) recién
se agregó en `b014ff2` (28/08/2026), 3 días después. `.gitignore` no desengancha
retroactivamente archivos ya trackeados — haría falta un `git rm --cached`
explícito, que nunca se hizo. No es urgente (son 4 archivos, no un problema de
tamaño de repo), pero conviene resolver la inconsistencia entre "estos archivos
están en `.gitignore`" y "estos archivos están commiteados" en algún momento.

### 5. Verificación funcional pendiente de Tandas 0 y 1 — Severidad: Media-Alta

Según la tabla de resultados de `VERIFICACION_TANDA_0_1.md` (líneas 171-185),
verificación del 04/09/2026:
- **No ejecutado:** puntos 1-5 (Tanda 0 completa: fallback del `ErrorBoundary`,
  resto de la app viva, "Reintentar", limpieza al navegar, `logError` en
  consola — no se provocó ningún error de render en la sesión).
- **No ejecutado:** puntos 7, 8, 9, 10 (Tanda 1: `LoadingState` con latencia
  alta, `ErrorState` + reintento con fallo forzado, los 2 reintentos con backoff
  visibles en consola, deep-link Proveedores→Compras).
- **No ejecutado:** puntos 12, 13 (cancelación de requests al tipear rápido,
  cambio de sucursal sin afectar el listado).
- **Verificado (parcial):** puntos 6 y 11 (carga/paginación/orden del listado de
  Proveedores, y alta de proveedor) — ver detalle en ese mismo documento.

Es la deuda de mayor severidad de esta lista: el `ErrorBoundary` extendido y toda
la política de timeout/reintentos/cancelación de `httpClient` están en producción
(commiteados y pusheados) sin haberse ejercitado en el navegador todavía. Los
escenarios siguen disponibles tal cual están documentados, con las variables de
`.env.local.ejemplo-verificacion` — no requieren ningún cambio de código adicional
para retomarse.

---

## Reportados pero no reproducidos (verificados y descartados)

Estos dos ítems se investigaron con evidencia de código directa (no solo lectura
rápida) y **no reproducen tal como fueron descritos**. Se dejan documentados acá
en vez de omitirlos, para que quede registro de que se revisaron.

### `NewTransactionModal.tsx` (cash) — formato de hora: NO es un bug

La preocupación era que `toLocaleTimeString('es-AR')` devuelve 12h con AM/PM,
incompatible con el `HH:mm` estricto que exige `<input type="time">`. En el
código actual (`NewTransactionModal.tsx:39`) la llamada es:

```ts
now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
```

El `hour12: false` está pasado explícitamente, así que el resultado ya es 24h
(`HH:mm`) — compatible con el `<input type="time">` de la línea 80. No hay
mismatch en el código tal como está hoy.

### `OrderProductsSection` — escáner de códigos de barras: el `await` ya está

La preocupación era que faltaba `await` en la mutación async del handler del
escáner. En el código actual (`OrderProductsSection.tsx:46-60`), `handleKeyDown`
es `async` y la línea 60 ya tiene:

```ts
const stockRecord = activeBranchId ? await getStockForBranch(match.id, activeBranchId) : undefined;
```

El `await` está presente. Nota aparte, de menor severidad: el handler no tiene
ningún guard de reentrancy (no hay una bandera tipo `isProcessing` que bloquee un
segundo `Enter` mientras el primero todavía está esperando `getStockForBranch`) —
dos escaneos muy rápidos en sucesión podrían seguir pisándose por el cierre
(`closure`) desactualizado de `items`, pero ese es un problema distinto al que se
reportó originalmente ("falta el `await`"), y de severidad baja dado que un
escáner físico normalmente no dispara dos `Enter` en un intervalo tan corto.

---

## Tabla resumen

| # | Ítem | Estado | Severidad |
|---|---|---|---|
| 1 | Edición de proveedor sin botón disparador | Vigente | Media |
| 2 | Filtros zona/vendedor/estado en ClientAccountsTable | No aplica (alcance documentado) | — |
| 3 | `modules/compras` en español | Vigente | Baja |
| 4 | 4 .docx/.pdf trackeados pese a `.gitignore` | Vigente | Baja |
| 5 | Verificación funcional Tandas 0/1 (puntos 1-5, 7-10, 12-13) | Vigente | Media-Alta |
| — | `NewTransactionModal` formato de hora | No reproduce | — |
| — | `OrderProductsSection` `await` faltante | No reproduce (resuelto o nunca existió así) | — |
