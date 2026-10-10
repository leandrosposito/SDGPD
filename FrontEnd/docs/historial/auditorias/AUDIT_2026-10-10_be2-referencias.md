# AUDIT 2026-10-10 — BE-2: referencias cruzadas a proveedores, motivos, vehículos y choferes

> Verificado contra el filesystem el **2026-10-10**, en la rama `sesion-be2-2026-10-10` (desde `lean` `e719e96`), con `grep -rn` sobre `FrontEnd/src` y `FrontEnd/scripts`. Si leés esto después, reverificá: los números de línea se mueven.

**Qué busca:** todo lugar de `FrontEnd/src` donde **otro módulo** lee datos de proveedores, motivos, vehículos o choferes: imports de stores o de los datos del mock, funciones sincrónicas (`getVehicleById`), selectores, validaciones dentro de resolvers mock. Para cada uno: si lee **por el service (async)** o **directo del store**, y qué pasa en **modo mixto** (la entidad va por http, el módulo que la referencia sigue en mock) cuando la entidad es **nueva y real** (existe solo en el backend).

**Solo lectura.** No cambia código.

## Resumen

| Entidad | Lecturas directas del store fuera de su service | Lecturas por el service | ¿Pasa a http en BE-2? |
|---|---|---|---|
| Vehículos | **3**, todas por `getVehicleById` (sincrónica) en `trips.service.ts` | 1 (`fetchActiveVehicles`, `TripsPage`) | **Sí.** Los 3 lugares están dentro de resolvers mock que ya son (o pueden ser) async: la conversión a la función async del service no reescribe el dominio |
| Choferes | 0 | 1 (`fetchActiveDrivers`, `TripsPage`) | **Sí** |
| Proveedores | 0 | 2 (`fetchSuppliers` en `ComprasPage` e `InventoryPage`) | **Sí** |
| Motivos | 0 | 5 (`getMotivoCatalog`: 2 resolvers de `deliveries.service` y 3 modales) | **Sí** |

Ningún módulo importa `data/mock/{suppliers,vehicles,drivers,motivos}.data.ts`: los únicos imports son los de sus propios services (`suppliers.service.ts:4`, `vehicles.service.ts:5`, `drivers.service.ts:5`, `motivos.service.ts:2`).

Además de las lecturas, hay **datos del mock que guardan ids** de estas entidades (sección C): no leen nada, pero en modo mixto son las referencias que tienen que resolver contra el backend. Por eso la Parte 2 los pasa a los UUID fijos del seed.

## A. Lecturas directas del store (sincrónicas) — hay que pasarlas al service

| # | Lugar | Qué lee | Modo mixto, vehículo nuevo y real (`vehicles` por http, `trips` en mock) |
|---|---|---|---|
| A1 | `modules/logistics/services/trips.service.ts:70` (`releaseDeliveryFromTrip`, llamada desde `deliveries.service.ts:495`, dentro del resolver de `reprogramDelivery`) | `getVehicleById(trip.vehicleId)` → `vehiclesStore` del mock | No lo encuentra: `vehicle === undefined` → `sobrecargado = false` **siempre**. El viaje queda con el flag de sobrecarga mal recalculado, sin error visible |
| A2 | `trips.service.ts:233` (resolver de `createTrip`) | `getVehicleById(input.vehicleId)` | No lo encuentra → `{ success: false, reason: 'vehicle-not-found' }`. **No se puede armar un viaje con un vehículo recién creado** |
| A3 | `trips.service.ts:368` (resolver de `assignDeliveriesToStop`) | `getVehicleById(trip.vehicleId)` | No lo encuentra → `sobrecargado = false`: **la validación de capacidad no corre** (asigna sin límite y sin pedir `forzar`) |

**Cómo se resuelve (Parte 2):** `getVehicleById` pasa a ser async y va por `httpClient` (`GET /vehicles/{id}`, service `vehicles`), así resuelve contra el backend o contra el mock según el modo del service `vehicles`, no del de `trips`.
- A1 y A2: `reprogramDelivery` ya corre en un resolver `async` (`deliveries.service.ts:431`), así que alcanza con un `await`.
- A2 y A3: los resolvers de `createTrip` (`:232`) y `assignDeliveriesToStop` (`:328`) son sincrónicos, pero `withIdempotency` y `runMock` aceptan una promesa (`shared/utils/idempotency.ts`, `httpClientCore.ts:246`): pasan a `async`.
- **Detalle:** el vehículo se busca **antes** de leer el estado del viaje que se va a modificar. Así el `await` no queda en medio de "leer versión, validar y escribir" del store del mock: el chequeo de versión y la escritura siguen siendo contiguos.
- No hace falta reescribir el dominio logístico.

## B. Lecturas por el service (async) — funcionan en modo mixto si los ids coinciden

| # | Lugar | Función | Para qué | Modo mixto, entidad nueva y real |
|---|---|---|---|---|
| B1 | `modules/compras/ComprasPage.tsx:178` | `fetchSuppliers` | `suppliersById` (`:290`): nombre en `PurchaseOrdersTable.tsx:50`, `TabPendingReceipt.tsx:149`, `ComprasPage.tsx:377` y `PurchaseOrderDetailPanel.tsx:66`; selector de `PurchaseOrderFormModal.tsx:217`; `defaultSupplierId` (`:110`) | La lista viene del backend: el proveedor nuevo aparece en el selector y su OC muestra el nombre. **Las OC del mock** guardan `supplierId` del mock (C2): sin ids compartidos mostrarían "Proveedor no disponible" |
| B2 | `modules/inventory/InventoryPage.tsx:113` | `fetchSuppliers` | selector de `ProductFormModal.tsx:267`; `TabPurchases.tsx:110,136`: regla **O9** (un producto sin proveedor válido no genera OC) | Igual que B1. **Los productos del mock** guardan `supplierId` (C1): sin ids compartidos, **todos** caerían en la regla O9 |
| B3 | `modules/logistics/TripsPage.tsx:67,71` | `fetchActiveVehicles`, `fetchActiveDrivers` | `vehiclesById`/`driversById` (`:77-78`): `TripsTable.tsx:26-27`, `TripDetailPanel` (`TripsPage.tsx:200-201`), selectores de `CreateTripModal.tsx:298,309` y filtros de `TripsPage.tsx:150,158` | La lista viene del backend: el vehículo y el chofer nuevos aparecen en el selector. **Los viajes del mock** (C3) muestran el id crudo si los ids no coinciden. (Un vehículo **inactivo** de un viaje viejo ya mostraba el id crudo antes de BE-2: es la misma lista de activos) |
| B4 | `modules/logistics/services/deliveries.service.ts:458` (no entrega / reprogramación) y `:563` (`registrarEntrega`) | `getMotivoCatalog` | valida el motivo y toma su descripción | Funciona: se referencia por **`codigo`** (`DeliveryNoteLine.motivoCodigo`, ADR-010 §5), no por id. El seed usa los mismos códigos |
| B5 | `NoEntregaModal.tsx:73`, `RegistrarEntregaModal.tsx:104`, `ReprogramarModal.tsx:69` | `getMotivoCatalog` | selector y `requiereEvidencia` (`RegistrarEntregaModal.tsx:149`) | Funciona, por código |

**Universo completo.** B1 a B3 piden **todo** el catálogo, sin límite. La regla 3.1 y ADR-016 piden búsqueda acotada. Pero esos lugares usan la lista también como **diccionario de nombres** de documentos viejos, no solo como selector. La Parte 1 lo resuelve con una búsqueda acotada que avisa si se truncó (`truncated`). Ver ADR-BE-004, sub-decisión de BE-2.

## C. Datos del mock que guardan ids de estas entidades (no leen; tienen que compartir ids)

| # | Archivo | Referencias |
|---|---|---|
| C1 | `data/mock/inventory.data.ts` | `supplierId` de los 19 productos (`:15`, `:35` y las filas `:49-68`). **`inv-019` → `'sup-999'`, inexistente a propósito** (`:65-68`, regla O9): se reemplaza por un UUID que **no** está en el seed |
| C2 | `data/mock/purchaseOrders.data.ts` | `PRODUCTS_BY_SUPPLIER` (`:30-32`), `supplierId` de 7 OC (`:56`-`:121`) y `SUPPLIER_IDS` del generador (`:134`) |
| C3 | `data/mock/trips.data.ts` | `vehicleId`/`driverId` de los 2 viajes (`:32-33`, `:69-70`) |
| C4 | `data/mock/inventory.data.ts:180-219` | `supplierName` de las sugerencias de compra: **nombre** desnormalizado (foto), no un id. No cambia |
| C5 | motivos | ningún dato del mock guarda motivos: las entregas los referencian por `codigo` al registrarse |

## D. Validaciones dentro de resolvers mock

| # | Lugar | Qué valida | Modo mixto |
|---|---|---|---|
| D1 | `services/mock/purchaseOrders.service.ts:273` (`createPurchaseOrder`) y `:357` (`generatePurchaseOrderFromSuggestion`) | `invalid-supplier` **solo si `supplierId` está vacío**: no lee el store de proveedores | Acepta el proveedor nuevo y real (y también cualquier id inexistente, como ya pasaba). La existencia la va a garantizar la FK compuesta de BE-8. Fuera de alcance |
| D2 | capacidad de `trips` | ver A1 y A3 | — |
| D3 | `vehicles.service`/`drivers.service`/`suppliers.service` | duplicados contra su propio store | no es una referencia cruzada |

## E. Scripts de verificación que importan estos mocks

- `scripts/verificacion/v12-trips-referential-integrity.mjs`: viaje → vehículo y viaje → chofer.
- `v13-tanda11-integrity.mjs`: vehículos y motivos.
- `v14-tanda12-integrity.mjs`: proveedores.
- `v16-avance-2026-09-30-integrity.mjs`: producto → proveedor, regla O9.

Comparan por **conjuntos** (`Set` de ids del mock), no por ids literales, así que no hay que modificarlos. Su salida sí cambia, porque imprime los ids.

`scripts/smoke/tanda-10b.smoke.mjs:136-146` prueba que los constructores de id **aceptan el prefijo legado** (`asVehicleId('veh-001')`). Es una propiedad del constructor (ADR-BE-004, sub-decisión 1), no de los datos, y sigue valiendo.

## Qué está bien y no hay que romper

- Ningún módulo importa los datos del mock de estas cuatro entidades (el único acoplamiento directo es `getVehicleById`).
- `getMotivoCatalog` ya se usa async desde adentro de los resolvers de entregas.
- La regla O9 está en la UI (`TabPurchases.tsx:136-147`) y depende solo de `suppliersById`.

## Plan

1. **Parte 1:** el backend de las cuatro entidades.
2. **Parte 2:** UUID compartidos en C1 a C3 (O9 con un UUID fuera del seed) y A1 a A3 por el service async.
3. **Parte 3:** las cuatro entidades por http. Según esta auditoría ninguna tiene que quedarse en mock.
