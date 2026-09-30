# Verificación Tanda 16 — Los 10 campos "fantasma" restantes de `CreateClientModal` (PENDIENTES.md ítem 15)

**Fecha:** 2026-09-11. Cierra `docs/PENDIENTES.md` ítem 15: además de `priceList`/`saleCondition` (conectados en Tanda 12), `CreateClientModal.tsx` tenía otros 10 campos capturados en la UI y descartados en silencio al guardar (`buildClientInput()` no los incluía) — **corrección de conteo:** el propio ítem 15 decía "9 campos", pero la lista enumerada ahí mismo (`nombreFantasia`, `condicionIva`, `email`, `googleMapsLink`, `isEntregaIgualFiscal`, `direccionEntrega`, `referenciasEntrega`, `categoria`, `notas`, `isActive`) tiene 10 nombres, y así lo confirma el recuento contra el código (19 `useState` totales − 9 conectados antes de esta tanda = 10, no 9). Se deja esta corrección registrada en vez de repetir el número viejo.

## Decisión (regla 2.9): conectar los 10, no quitar ninguno

Los 9 campos de `docs/PENDIENTES.md` (ítem 10, "4 tabs de inventory son UI sin funcionalidad") son el precedente para "quitar/no tocar": esos SÍ son UI de mentira (datos hardcodeados, sin `onClick`, sin tipo de dominio real detrás). Los 10 campos de este ítem son la situación opuesta: inputs controlados reales, con su propio `useState`, escribiendo a componentes que ya funcionan (`ClientGeneralTab`/`ClientLogisticsTab`/`ClientSettingsTab`) — mismo criterio que llevó a conectar (no quitar) `priceList`/`saleCondition` en Tanda 12. Se aplica la misma decisión a los 10 restantes, por consistencia.

## Qué cambió

- `shared/types/client.types.ts`: `ClientAccount` gana 10 campos nuevos, todos requeridos (sin `?`) — mismo criterio que `zone`/`sellerName` (valores que siempre existen, nunca "ausentes" a propósito): `tradeName`, `ivaCondition`, `email`, `googleMapsLink`, `deliveryAddressSameAsFiscal`, `deliveryAddress`, `deliveryReferences`, `businessCategory`, `notes`, `isActive`.
- `modules/clients/api/{dto,mapper}.ts`: los 10 campos viajan en el DTO (`cliente`/`cuenta`, snake_case) y en `ClientFormInput`/`ClientFormPayloadDTO` — misma cadena que `priceList`/`saleCondition`.
- `data/mock/clients.data.ts`: los 30 clientes semilla backfilleados con los defaults del formulario (uniforme, mismo criterio que el backfill de Tanda 12 — no hay dato de negocio real detrás para variarlos).
- `CreateClientModal.tsx`: `buildClientInput()` incluye los 10 campos; el precargado de edición (`useEffect` que llena el formulario cuando `client` no es null) también los lee de `client.*` — el mismo "doble hueco" que Tanda 12 cerró para `priceList`/`saleCondition` (guardar Y precargar), aplicado acá.

## Qué verificar en el navegador

1. **Alta de cliente con los 10 campos.** `/clientes` → Nuevo Cliente → completar las 4 tabs, incluyendo Nombre de Fantasía, Condición IVA, Email (tab General), Google Maps, "dirección de entrega distinta a la fiscal" + dirección + referencias (tab Logística), Categoría, Notas, "Cliente Activo/Inactivo" (tab Ajustes) → Guardar.
2. **Reabrir en modo edición.** Abrir el mismo cliente recién creado desde el Directorio → confirmar que las 4 tabs muestran EXACTAMENTE lo cargado en el paso 1 (no los defaults de un cliente nuevo) — este es el punto que Tanda 12 encontró roto para `priceList`/`saleCondition` cuando solo se arregla el guardado y no el precargado.
3. **Toggle "dirección de entrega igual a la fiscal".** Cargar una dirección/referencias de entrega, desmarcar el checkbox, guardar, reabrir — la dirección/referencias deben seguir ahí y el checkbox debe seguir desmarcado (no volver a `true` por default).
4. **Cliente inactivo.** Marcar "Cliente Inactivo" en Ajustes, guardar, reabrir — el toggle debe seguir en "Inactivo" (hoy no hay ningún filtro/badge en el Directorio que dependa de este campo — ver "Qué NO se verificó").

## Qué NO se verificó

- **No se agregó ningún indicador visual de `isActive` en `ClientDirectoryTable`/`ClientAccountsTable`** (badge, filtro, etc.) — la tarea pedida era conectar el campo del formulario de punta a punta (que se guarde y se relea), no agregar una feature de UI nueva sobre el listado. `isActive` hoy se persiste y se re-lee correctamente, pero no cambia nada visible fuera del propio modal.
- No se verificó en navegador el caso de los 30 clientes semilla (todos con los mismos defaults) — cubierto por `scripts/verificacion/v15-tanda14-16-integrity.mjs` (D2), no por click real.

## Decisiones tomadas sin consultar (regla 2.9)

- **Los 10 campos nuevos son requeridos (`string`/`boolean`, sin `?`)**, no opcionales — simplifica el mapper/DTO (sin manejo de `undefined` en ningún lado) y es consistente con que el resto de `ClientAccount` no tiene ningún campo opcional, aunque implica backfillear los 30 registros semilla con valores por default en vez de dejarlos "ausentes".
- **Corrección del conteo "9 campos" → 10 campos** en `docs/PENDIENTES.md` (regla 2.10 del protocolo: toda afirmación sobre el código se reverifica contra el filesystem antes de confiar en ella) — se corrige al cerrar el ítem, no se repite el número viejo.
- **Sin nueva UI en el Directorio para `isActive`** — ver "Qué NO se verificó". Si en el futuro se decide que un cliente inactivo debe ocultarse/marcarse en algún listado, es una decisión de producto nueva, no parte de "conectar el campo que ya existía en el formulario".
