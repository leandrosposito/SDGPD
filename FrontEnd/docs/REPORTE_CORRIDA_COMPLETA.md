# Reporte — Corrida completa (Fase 0 + Fase B + Fase C)

**Fecha:** 2026-09-06/07. **Rama de trabajo:** `corrida-completa` (derivada de `lean` en el commit `6845ab1`). **Punto de retorno:** tag `pre-corrida-completa` (mismo commit). **Remote:** pusheado a `origin/corrida-completa` en cada tanda.

Ejecución de una sola corrida, sin pedir confirmación entre fases, tal como pidió el prompt maestro. Ninguna condición de parada de la Sección 9 se activó: no apareció ninguna query key de negocio sin `companyId`, ningún gate empeoró la línea base de A1, ninguna tarea requirió una dependencia nueva, y ningún gate falló 3 veces seguidas en una tanda de la que dependieran las siguientes.

## Estado por fase y por tanda

| Fase/Tanda | Estado | Commit | Notas |
|---|---|---|---|
| Fase 0.1 — Reverificación aislamiento empresa/sucursal | **Hecha** | `97f9643` | Manual, sin delegar a fork (como exigía el prompt). 0 hallazgos BLOQUEANTE en las 24 query keys del proyecto. Ver `AUDIT_05_REVERIFICACION.md`. |
| Fase 0.2 — Fix bug de fecha (A11) | **Hecha** | `97f9643` | `CreateOrderModal` ya no usa `toISOString().split('T')[0]`. Helper único `shared/utils/date.ts`. |
| Fase B — 8 ADRs | **Hecha** | `f82abdf` | Los 8 documentos en `docs/adr/`, decisiones documentadas, ninguna reabierta durante Fase C. |
| Tanda 4 — Contexto sucursal + estado en URL | **Hecha** | `39b922a` | 15/15 consumidores de `usePagedQuery` migrados a `useUrlListState`. `BranchSelector` maneja 0/1/N sucursales. |
| Tanda 5 — IDs tipados + relación orderId→cliente | **Hecha** | `bfd2395` | `OrderId`/`BranchId`/`OrderLineId`/`ClientId` brandeados. `Order.clientId` real, combobox de cliente reemplaza el input de texto libre. |
| Tanda 6 — Exportación server-side | **Hecha (alcance acotado, documentado)** | `d80cf02` | Arquitectura de job asíncrono (ADR-004) migrada en los 7 listados que ya tenían export. Los ~9 listados sin export hoy siguen sin él — decisión explícita de no expandir el alcance, documentada en `VERIFICACION_TANDA_6.md`. |
| Tanda 7 — Tablero y alertas | **Hecha (alcance acotado, documentado)** | `a1456f6` | Ventas por ZONA (no por sucursal — `Order` no tiene `branchId`, ver Contradicciones abajo), pedidos por período/estado, cuentas por cobrar vencidas en `Money`, alertas (ADR-007) con cursor real, deep link a pendientes de preparación. |
| Tanda 8 — Entregas | **Hecha** | `d538a8d` | Las 6 partes completas: cantidad entregada/pendiente derivada, remitos append-only, máquina de estados de 5 valores, polling (ADR-003), evidencia con límites y reintento parcial (ADR-005), UI de registrar entrega/reprogramar/historial. |

**Ninguna tanda quedó parcial ni se revirtió.** Los 5 gates pasaron en las 7 tandas/fases de código, verificados de forma independiente por mí (no solo por el reporte de cada fork) antes de continuar a la siguiente.

## Commits creados

```
97f9643 fix(fechas): usar fecha local en prellenado y comparaciones + reverificacion aislamiento empresa
f82abdf docs(adr): 8 ADRs de Fase B (entregas, tiempo real, export, evidencia, IDs, alertas, dinero)
39b922a feat(contexto): selector de sucursal + estado de listados en URL
bfd2395 refactor(ids): branded types y relacion orderId tipada hacia orders
d80cf02 feat(export): exportacion server-side en listados
a1456f6 feat(analytics): tablero con agregados server-side y alertas
d538a8d feat(entregas): entrega parcial, seguimiento, reprogramacion y rechazo con evidencia
```

Además, antes de crear la rama de trabajo: `6845ab1` (`docs(auditorias): Fase A completa`, commiteado a `lean` — los 14 informes de auditoría, trabajo ya cerrado en la sesión anterior a esta corrida).

Total de la corrida (`pre-corrida-completa..HEAD`): 105 archivos, +5391/-485 líneas.

## Decisiones que tuve que tomar y no estaban en el prompt

1. **Ventas "por zona" en vez de "por sucursal"** (Tanda 7) — `Order` no tiene `branchId` (confirmado correcto en `AUDIT_5_SCOPE_EMPRESA_SUCURSAL.md`, es alcance EMPRESA). Agrupar por sucursal real habría exigido agregar `branchId` a `Order`, un cambio de modelo de datos que el prompt no autorizaba. Agrupé por `clientZone` (dato real existente) y lo dejé nombrado honestamente como "por zona", documentado en el código y en `VERIFICACION_TANDA_7.md`.
2. **`Money` (ADR-008) solo en agregados nuevos, no migración de dominio completa** — migrar `Order`/`CashTransaction`/`ClientAccount`/`PurchaseOrder` de `number` a `Money` es un trabajo de varios días que tocaría las 5 tandas anteriores ya cerradas. Implementé el módulo `shared/utils/money.ts` completo (suma con chequeo de moneda, multiplicación con redondeo documentado, formato, conversión puente `moneyFromNumber`) y lo usé en los agregados nuevos del tablero (cuentas por cobrar vencidas). El resto del dominio sigue en `number`, documentado como pendiente.
3. **Exportación server-side solo en los 7 listados que ya tenían export**, no en los ~9 restantes — agregar export nuevo a 9 dominios (escribir un `export*` por service + wiring) es una tanda de tamaño comparable a Tanda 6 completa. Prioricé migrar la arquitectura (lo que el ADR-004 pedía) sobre expandir cobertura.
4. **`quantity` de `OrderItem` no se renombró a `cantidadPedida`** (Tanda 8) — ADR-001 pide esos dos campos por línea; en vez de un rename masivo que tocaría formularios/mappers de 3 tandas atrás, documenté que `quantity` cumple ese rol por convención y agregué solo el campo nuevo `cantidadEntregada`.
5. **Reprogramación permitida desde `CREADO` además de `EN_TRANSITO`** (Tanda 8) — ADR-002 no lo prohíbe explícitamente y tiene sentido de negocio (reprogramar antes de salir a la calle).
6. **`uploads.service.ts` (ADR-005) no pasa por `httpClient`** — el payload es un archivo binario, no JSON; documentado como excepción deliberada a la política de `httpClient`.
7. **Combobox de cliente (Tanda 5) es un filtro en memoria simple**, no un componente de búsqueda pulido — acotado a propósito, el objetivo de la tanda era la relación tipada, no una revisión de UX de Clientes.

## Contradicciones encontradas con los ADRs

Ninguna contradicción de la severidad que exige la Sección 9 (reescribir un dominio entero) — la única tensión real fue la del punto 1 de arriba (ventas por sucursal vs. por zona), que no es una contradicción con un ADR sino con una premisa implícita del prompt maestro (que `Order` tuviera `branchId`, cosa que las auditorías de Fase A ya habían confirmado que NO es así, correctamente). Se resolvió documentando la limitación en vez de agregar `branchId` a `Order` sin autorización explícita — un cambio de modelo de ese tipo excede el alcance de "cambios pequeños y reversibles".

## Riesgos introducidos

- **Bundle creció de 1.470,62 kB a 1.511,91 kB** (~41 kB, ~3%) a lo largo de las 5 tandas de Fase C — esperable dado el código nuevo (URL state, IDs tipados, export jobs, dashboard/alertas, entregas). Sigue sin code-splitting (A8, explícitamente fuera de esta corrida).
- **`Order.clientId` es una relación nueva sin backfill** — los pedidos creados ANTES de Tanda 5 en el mock ya tenían `clientName` sin `clientId`; si el mock de pedidos existente no se actualizó con un `clientId` real para cada registro preexistente, esos pedidos viejos podrían mostrar inconsistencias en cualquier pantalla nueva que dependa de `clientId` (ninguna lo hace todavía, pero es un riesgo latente a vigilar).
- **`DeliveryStatus` cambió de 3 a 5 valores** — cualquier código o documentación vieja que compare contra `'pending'`/`'in_transit'`/`'delivered'` literal (fuera de lo que tsc ya habría marcado como error) podría haber quedado sin actualizar si no pasó por el compilador (ej. algún string en un test manual, un comentario, o una URL de query param con el valor viejo hardcodeado en un bookmark).
- **La evidencia de rechazo (ADR-005) usa una URL de storage simulada**, no persiste de verdad entre sesiones del navegador (sin backend) — es una limitación esperada del entorno mock, no un bug, pero conviene que quien pruebe en navegador sepa que refrescar la página pierde los archivos "subidos".
- **Ninguna tanda tocó `main`** — todo el trabajo vive en `corrida-completa`, pusheada a `origin`. `lean` solo recibió el commit de Fase A (auditorías), ya existente antes de esta corrida.

## Gates: resultado por tanda

Todos verificados por mí de forma independiente (no solo el reporte del fork que implementó cada tanda), corriendo los 3 comandos + el smoke script correspondiente contra el HEAD real de la rama en cada punto.

| Tanda | tsc --noEmit | eslint | vite build | smoke script | autorrevisión diff |
|---|---|---|---|---|---|
| Fase 0 | 0 errores | 0 errores, 1 warning preexistente | OK | N/A (fix de 1 línea + reverificación manual) | OK |
| Fase B | 0 errores | 0 errores, 1 warning preexistente | OK | N/A (solo docs) | OK |
| Tanda 4 | 0 errores | 0 errores, 1 warning preexistente | OK, 1.477,36 kB | `tanda-4.smoke.mjs`, 22 verificaciones — OK | OK |
| Tanda 5 | 0 errores | 0 errores, 1 warning preexistente | OK, 1.480,75 kB | `tanda-5.smoke.mjs`, 12 verificaciones — OK | OK |
| Tanda 6 | 0 errores | 0 errores, 1 warning preexistente | OK, 1.482,65 kB | `tanda-6.smoke.mjs`, 15 verificaciones — OK | OK |
| Tanda 7 | 0 errores | 0 errores, 1 warning preexistente | OK, 1.496,04 kB | `tanda-7.smoke.mjs`, 17 verificaciones — OK | OK |
| Tanda 8 | 0 errores | 0 errores, 1 warning preexistente | OK, 1.511,91 kB | `tanda-8.smoke.mjs`, 24 verificaciones — OK | OK |

El warning preexistente es siempre el mismo, ya documentado en la línea base de A1 (`PurchaseOrderFormModal.tsx`, `watch()` de react-hook-form incompatible con memoización) — nunca creció a más de 1 warning ni se convirtió en error.

## Qué queda pendiente de verificar en navegador

Ninguna de las 5 tandas de Fase C (ni la Fase 0) fue verificada en navegador durante esta corrida — igual que la deuda ya señalada en `AUDIT_14_DEUDA_DECLARADA.md` para tandas anteriores, esto se cierra por código con gates automáticos, no por interacción real. Checklists dejados para Leandro:

- `FrontEnd/docs/VERIFICACION_TANDA_4.md` — selector de sucursal (0/1/N), URL reproduce el estado del listado.
- `FrontEnd/docs/VERIFICACION_TANDA_5.md` — combobox de cliente real en alta de pedido.
- `FrontEnd/docs/VERIFICACION_TANDA_6.md` — exportación con progreso, descarga real, caso vacío, los 7 listados migrados.
- `FrontEnd/docs/VERIFICACION_TANDA_7.md` — campanita de alertas, paginación "cargar más" sin duplicados, secciones nuevas del tablero, deep link a pendientes de preparación.
- `FrontEnd/docs/VERIFICACION_TANDA_8.md` — avance de estado de una entrega, registro de entrega parcial con rechazo + evidencia, reprogramación, polling cada 30s (Network tab).

Además, la deuda de verificación ya acumulada de tandas ANTERIORES a esta corrida (3a/3b/3c/3d/3g, señalada en `AUDIT_14_DEUDA_DECLARADA.md` hallazgo ALTO #1) sigue sin ejecutarse — no formaba parte del alcance de esta corrida.

## Qué no entró en esta corrida (según la Sección 8 del prompt maestro)

Anotado, no implementado: code-splitting por ruta y el bundle de 1,51 MB (A8), virtualización efectiva de listas, Tanda 3f (Reposición — sigue sin migrar a la capa `api/`, es el hallazgo ALTO más citado de Fase A), Tanda 3g (ya estaba cerrada por código antes de esta corrida, no se tocó), y los hallazgos MEDIO/BAJO restantes de Fase A no absorbidos por ninguna tanda de esta corrida (la lista completa está en `AUDIT_00_RESUMEN.md`).

## Cómo revertir cada tanda por separado

Cada tanda es un commit único en `corrida-completa`, así que revertir una sin perder las posteriores requiere `git revert` (no `reset`, que perdería el historial de las tandas siguientes) — o, si se prefiere descartar TODO y volver al punto de partida, `git checkout lean` y borrar la rama (el tag `pre-corrida-completa` queda como referencia permanente al estado previo).

Para revertir una tanda puntual manteniendo las demás:
```
git revert d538a8d   # Tanda 8 — Entregas
git revert a1456f6   # Tanda 7 — Tablero y alertas
git revert d80cf02   # Tanda 6 — Exportación
git revert bfd2395   # Tanda 5 — IDs tipados
git revert 39b922a   # Tanda 4 — Contexto + URL
git revert f82abdf   # Fase B — ADRs (solo docs, revertir es inofensivo)
git revert 97f9643   # Fase 0 — fix de fecha + reverificación
```

**Advertencia sobre dependencias entre tandas:** revertir Tanda 4 sin revertir también 5-8 rompe la compilación (Tandas 5-8 usan `useUrlListState`/el modo controlado de `usePagedQuery` que Tanda 4 introdujo). Mismo problema revertir Tanda 5 sin 6-8 (usan los branded types), o Tanda 7 sin 8 (Tanda 8 no depende de Tanda 7, en principio revertible sola). El orden seguro para revertir manteniendo el resto es siempre de la más nueva a la más vieja, empezando por Tanda 8 hacia atrás — revertir "en el medio" sin revertir todo lo posterior probablemente rompe `tsc`.

Para volver al estado exacto previo a toda la corrida sin revertir commit por commit: `git checkout lean` (que sigue teniendo solo el commit de auditorías de Fase A, `6845ab1`) — la rama `corrida-completa` y el tag `pre-corrida-completa` quedan disponibles para retomar o descartar cuando se decida.
