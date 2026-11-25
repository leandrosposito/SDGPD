# Verificación BE-0b (parte frontend): httpClient, ApiError e ids

**Fecha:** 2026-10-09. Sesión `sesion-be0b-2026-10-08` (`docs/PROTOCOLO.md`). Es el checklist de navegador para Leandro. Lo automático ya corrió: `tsc`, `lint`, `build`, los 31 scripts de smoke y verificación de la línea base y el smoke nuevo `scripts/smoke/be-0b.smoke.mjs` (32 chequeos contra un servidor HTTP local). **Nada de lo que sigue se probó en un navegador.**

## Qué cambió

- `shared/api/httpClient.ts`: la lógica pasó a `shared/api/httpClientCore.ts` (`createHttpClient`, sin `import.meta.env`, para poder correrla con `node`). `httpClient.ts` solo lee la configuración de Vite.
- Modo http: el cuerpo de error `{ code, message, details }` llega a `ApiError` (`serverCode`, `message`, `details`, `status`). `idempotencyKey` viaja como header `Idempotency-Key`.
- **Reintentos:** GET se reintenta como antes. POST, PUT, PATCH y DELETE **solo se reintentan si llevan `idempotencyKey`**. Las mutaciones de logística, vehículos y choferes pasan la clave que ya generaban, así que se siguen reintentando. Las demás (pedidos, clientes, proveedores, productos, caja, compras, alertas, usuarios y `updateStopOrder` de viajes) ya no se reintentan ante un 5xx o un timeout.
- `shared/types/ids.types.ts`: los `is*Id`/`as*Id` aceptan UUID o el prefijo legado.

En modo mock (el default), nada de esto cambia lo que se ve. El checklist confirma eso.

## Pasos (modo mock, `npm run dev` sin variables nuevas)

### 1. Entregas (`/logistica`)

- [ ] En una entrega en estado pendiente, click en el ícono **"Marcar en ruta"**. Esperado: toast verde `Entrega <id> actualizada a "En Ruta"`, y la fila cambia de estado al refrescarse la lista.
- [ ] En esa misma entrega, **"Registrar entrega"**: completar las cantidades y confirmar. Esperado: toast de éxito y estado final (entregada o parcial, según las cantidades).
- [ ] En otra entrega, **Reprogramar**: elegir una fecha nueva y confirmar. Esperado: toast de éxito y fecha nueva en la fila.

### 2. Crear una entrega desde un pedido (`/pedidos`)

- [ ] Abrir el detalle de un pedido que admita entrega y click en **"Nueva entrega"**. Completar el modal y confirmar. Esperado: toast de éxito, y la entrega aparece en `/logistica` (misma sucursal).

### 3. Viajes (`/logistica/viajes`)

- [ ] **"Nuevo viaje"**: elegir vehículo, chofer y entregas, y confirmar. Esperado: el viaje aparece en la lista.
- [ ] En el detalle del viaje: **"Despachar"**. Esperado: el estado cambia a Despachado.
- [ ] En una parada: registrar el POD, y en otra, **"No visitada"** con motivo. Esperado: toasts de éxito y estados actualizados.

### 4. Vehículos (`/logistica/vehiculos`) y choferes (`/logistica/choferes`)

- [ ] **"Nuevo vehículo"**: patente nueva y confirmar. Esperado: aparece en la lista. Repetir con la misma patente: el error de patente duplicada se muestra igual que antes.
- [ ] Editar el vehículo y activarlo o desactivarlo. Esperado: los cambios se ven en la fila.
- [ ] **"Nuevo chofer"**: alta, edición y activar/desactivar, igual que con el vehículo.

### 5. Doble click (idempotencia del mock, sin cambios)

- [ ] En "Nuevo vehículo", hacer doble click rápido en confirmar. Esperado: **un solo** vehículo nuevo (igual que antes de BE-0b).

### 6. Consola

- [ ] Con DevTools abierto, recorrer los pasos 1 a 4. Esperado: ningún error nuevo en consola.
- [ ] Opcional: con `VITE_API_DEBUG=true`, los logs `[httpClient] req-N start/resolved` siguen saliendo como antes.

## Opcional: falla simulada (`VITE_MOCK_FAILURE_RATE=1`)

Es el único lugar donde el cambio de reintentos se ve en modo mock:

- [ ] Con `VITE_API_DEBUG=true` y `VITE_MOCK_FAILURE_RATE=1`, crear un vehículo. Esperado en consola: `start`, dos `retry` y `error` (lleva clave, se reintenta).
- [ ] Con la misma configuración, crear un proveedor en `/proveedores`. Esperado: `start` y `error`, **sin** `retry` (no lleva clave). Antes de BE-0b salían dos `retry`.

## No cubierto acá

El modo http contra el backend real: todavía no hay endpoints de negocio (BE-1 en adelante). El camino http lo cubre el smoke `be-0b.smoke.mjs` contra un servidor local.
