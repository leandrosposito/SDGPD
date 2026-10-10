# BE-02 — Maestros de logística

**Verificación:** 2026-10-10, `lean=e719e96c870244bc67756f3fa91f929315ef761c`. **Estado:** en curso en `origin/sesion-be2-2026-10-10` (`b1aedf5`, precedido por `8f83cf3`). Esta spec separa lo que ya está en esa rama de lo que falta para cerrar la tanda.

## 1. Encabezado y estado

`[HECHO en rama]` La auditoría de referencias está en `FrontEnd/docs/historial/auditorias/AUDIT_2026-10-10_be2-referencias.md` en `8f83cf3`. `[HECHO en rama]` Contratos, migraciones 0007/0008, RLS, controllers, queries, seed y aislamiento están en `b1aedf5`; no se verifican contra `lean` hasta que la rama se mergee.

## 2. Objetivo

Al terminar, una empresa autenticada podrá listar, buscar, consultar, crear, editar y activar/desactivar proveedores, motivos, vehículos y choferes, aislados por RLS, con DTOs estrictos, permisos, idempotencia y `version` donde corresponde.

## 3. Depende de

Depende de BE-1a/BE-1b para actor, empresa, permisos, `/api`, `CommandInterceptor`, auditoría e idempotencia. `[HECHO en rama]` BE-2 asume UUID v7, schemas camelCase y `branchId` ausente porque los cuatro maestros son EMPRESA (`BackEnd/docs/adr/ADR-BE-002-tenancy-rls.md:18-22`). No depende de productos, pedidos ni stock; las referencias de esos mocks quedan para el arrastre frontend.

## 4. ADRs que aplica

`[DECIDIDO]` ADR-BE-001: Node 24, Drizzle SQL, contratos compartidos, Postgres y ocho gates. `[DECIDIDO]` ADR-BE-002: tenant desde sesión, `empresa_id`, RLS FORCE, FK compuestas y alcance EMPRESA. `[DECIDIDO]` ADR-BE-003: actor/permisos desde sesión. `[DECIDIDO]` ADR-BE-004: UUID v7, DTO camelCase, errores 4xx y offset/search acotado. `[DECIDIDO]` ADR-BE-005: POST con `Idempotency-Key`, auditoría y comando transaccional; `version` en edición. `[DECIDIDO]` ADR-BE-006: dinero no aplica aún a estos maestros. Leer Objeciones de esos ADRs: las resoluciones de `/api`, PUT/DELETE idempotentes y usuario opcional del chofer prevalecen sobre el texto histórico.

## 5. Modelo de datos

`[HECHO en rama]` Tablas `suppliers`, `vehicles`, `drivers`, `motivos`: `id uuid`, `empresa_id uuid NOT NULL`, `version integer NOT NULL DEFAULT 1`, `created_at timestamptz NOT NULL`; PK y UNIQUE compuesto `(empresa_id,id)`, RLS ENABLE/FORCE y policy `app.empresa_id` en `BackEnd/drizzle/0007_masters.sql` y `0008_rls_masters.sql` (existencia contra la rama).

- `[HECHO en rama]` Supplier sale de `Supplier` (`02_MODELO_DE_DATOS.md:73-78`): `name`, `cuit`, `cuitNormalized`, phone/contact/address/city/paymentTerms/category, `active`. UNIQUE `(empresa_id,cuit_normalized)` y check de CUIT de 11 dígitos.
- `[HECHO en rama]` Vehicle sale de `Vehicle` (`02_MODELO_DE_DATOS.md:158-160`): patente normalizada, tipo, capacidades no negativas, refrigerado y zonas. UNIQUE `(empresa_id,patente)`.
- `[HECHO en rama]` Driver sale de `Driver` (`02_MODELO_DE_DATOS.md:161-162`): nombre, licencia normalizada, teléfono, activo, `usuarioId` nullable; UNIQUE de licencia y `(empresa_id,usuario_id)` cuando no es null; no convierte Driver en User.
- `[HECHO en rama]` Motivo sale de `MotivoCatalogItem` (`02_MODELO_DE_DATOS.md:164-165`): `(empresa_id,tipo,codigo)` único, código/tipo inmutables en edición, flags de evidencia y logística inversa.

Todos los listados son EMPRESA, sin `empresaId` en request. Los listados usan offset máximo 100; search usa `q`/`limit` máximo 100 y `truncated`. `version` se exige en PUT; activar/desactivar toma lock de la fila y es un comando separado. Los mocks conservan campos de UI; se renombran `activo`/`active` solo en mapper y se descartan contadores derivados y arrays `Supplier.products`.

## 6. Endpoints y contratos

`[HECHO en rama]` Permisos: suppliers × `ver|crear|editar`; logistics × `ver|crear|editar`. Paths reales bajo `/api`:

| Método | Path | Request/response | Reemplaza |
|---|---|---|---|
| GET | `/api/suppliers` y `/api/suppliers/search` | list offset / `{items,truncated}` | #53, #55 |
| GET/POST/PUT | `/api/suppliers/:id` | detalle, alta, edición con `version` | #53, #56, #57 |
| POST | `/api/suppliers/:id/activate|deactivate` | mutación idempotente | no existía |
| GET | `/api/vehicles`, `/api/vehicles/search`, `/api/vehicles/:id` | DTO anidado de capacidad | #87, #91 |
| POST/PUT/POST | `/api/vehicles`, `/:id`, `/:id/activate|deactivate` | create/update/toggle | #88–#90 |
| GET/POST/PUT | `/api/drivers`, `/api/drivers/search`, `/:id` | `usuarioId` opcional | #72, #76 |
| POST | `/api/drivers`, `/:id`, `/:id/activate|deactivate` | create/update/toggle | #73–#75 |
| GET/POST/PUT | `/api/motivos`, `/:id` | catálogo acotado, ABM | #77 |
| POST | `/api/motivos/:id/activate|deactivate` | transición | no existía |

Schemas estrictos de `packages/contracts/src/{search,suppliers,vehicles,drivers,motivos}.ts` en la rama. Errores: `cuit-duplicado`, `patente-duplicada`, `licencia-duplicada`, `user-not-found`, `user-already-linked`, `motivo-duplicado`, `motivos-limit-reached`, `version-conflict`; desconocido/tenant ajeno devuelve 404. Toda mutación lleva `Idempotency-Key` generado al abrir formulario, no al submit.

## 7. Reglas de negocio

Se conservan R-PRO-1..3, R-VEH-1..3 y R-CHO-1..2, con validación en servidor; `R-VEH-3` y `R-CHO-2` dejan de ser solo UI. Motivos mantienen código estable, `OTRO` por tipo y máximo 100. Vincular un usuario a un chofer valida pertenencia a empresa y unicidad. Activar/desactivar no incrementa `version` según la decisión de la rama; la edición sí. Cada comando es una transacción auditada. No se decide aquí la política de disponibilidad de vehículo/chofer para viajes (BE-07).

## 8. Seed y datos

`[HECHO en rama]` `BackEnd/scripts/db/{demo-masters,seed-masters,seed-dev}.ts` siembra ids UUID fijos para 3 suppliers, 4 vehicles, 3 drivers y 18 motivos; usa `ON CONFLICT DO NOTHING`, verifica presencia y conserva ediciones. El proveedor faltante intencional sirve para el caso O9. Antes del arrastre hay que resolver ids legacy `sup-*`, `veh-*`, `drv-*` en `FrontEnd/src/data/mock/{suppliers,vehicles,drivers}.data.ts` y referencias en inventory/purchaseOrders/trips; la auditoría de BE-2 lo identifica como trabajo pendiente, no se modifica en esta spec documental.

## 9. Arrastre frontend

Archivos verificados: `FrontEnd/src/modules/suppliers/api/suppliers.service.ts`, `FrontEnd/src/shared/api/{vehicles,drivers,motivos}/*.service.ts`, DTO/mapper/types de esos módulos, `FrontEnd/src/modules/suppliers/components/{SupplierFormModal,SupplierDetailPanel}.tsx`, `FrontEnd/src/modules/logistics/components/{VehicleFormModal,DriverFormModal}.tsx`, tablas/páginas y `FrontEnd/src/modules/logistics/services/trips.service.ts`.

Eliminar `empresaId` de requests; adaptar `{data,meta}` al wire único; cambiar `soloActivos` por `activo`; sustituir `/active` y `toggle-activo` por search/activate/deactivate; agregar `version`; crear claves al abrir modal; validar respuestas con DTO/mapper. Sumar `suppliers`, `vehicles`, `drivers`, `motivos` a `VITE_HTTP_SERVICES` solo después de los tests. Hacer async el lookup de vehículo de trips antes de activar HTTP. No convertir aún precios a Money: eso es BE-03.

## 10. Tests obligatorios

- RLS: lectura, alta, edición, activación y búsqueda cruzada entre dos empresas.
- Permisos: `ver`, `crear`, `editar`; ruta sin policy hace fallar bootstrap.
- Normalización y UNIQUE de CUIT, patente, licencia, motivo `(tipo,codigo)`.
- Payload desconocido, `empresaId` enviado, body actor y path ajeno rechazados.
- `version` obsoleta devuelve 409; dos ediciones concurrentes dejan una sola.
- Misma Idempotency-Key/payload reejecuta resultado; payload distinto devuelve 422.
- Seed idempotente y conserva edición; FK de `usuarioId` y borrado de tenant de prueba.
- Frontend: wire, mapper, ids UUID, clave al abrir y fallback mock.

## 11. Qué cierra

Cierra RF-PRO-001..004 y RF-LOG-002; endpoints #53–#57, #72–#77 y #87–#91; entidades Supplier, Vehicle, Driver y MotivoCatalogItem; reglas R-PRO-1..3, R-VEH-1..3 y R-CHO-1..2; hallazgo A14; PENDIENTES P-7 queda parcialmente resuelto por búsqueda, mientras P-22 queda resuelto para estos cuatro DTOs. Los ids completos están en `TRAZABILIDAD.md`: RF-PRO-001, RF-PRO-002, RF-PRO-003, RF-PRO-004, RF-LOG-002, R-PRO-1, R-PRO-2, R-PRO-3, R-VEH-1, R-VEH-2, R-VEH-3, R-CHO-1, R-CHO-2, A14, P-7, P-22, 53, 54, 55, 56, 57, 72, 73, 74, 75, 76, 77, 87, 88, 89, 90, 91.

## 12. Dependencias nuevas

Ninguna: la rama usa dependencias ya autorizadas por BE-0/BE-1. Si los tests de endpoint requieren una dependencia nueva, es condición de parada y debe registrarse, no instalarse.

## 13. Decisiones abiertas

`[ABIERTO D-08]` secuencia de migración de ids demo y adaptación del modo mixto. `[ABIERTO D-02]` no bloquea maestros, pero sí provisioning productivo.

## 14. Riesgos y trampas

No enviar `empresaId`; no confiar en `active` de UI; no usar `PUT /toggle-activo`; no tratar `Supplier.products` como relación persistida; no hacer lookup síncrono de vehículo desde trips; no usar ids mock legacy cuando el servicio HTTP espera UUID; no permitir que un catálogo search se convierta en lista ilimitada.

## 15. Tamaño

Conviene partir en 2a (contratos/tablas/RLS/queries) y 2b (tests, frontend y gates). La rama actual ya hizo 2a parcialmente; el corte es “backend aislado y verificable” versus “modo HTTP conectado”.

## 16. Lista cuando

La rama tiene typecheck/lint/build/tests en verde; cada endpoint tiene test de permiso, RLS, error, idempotencia/version; seed y migraciones pasan desde cero; frontend usa DTO/mappers y requests sin `empresaId`; trips no depende de stores síncronos; checklist y reporte están escritos; `docs:check BE-02` pasa; y los ocho gates de ADR-BE-001 tienen evidencia.

## 17. Decisiones que la rama ya tomó

`[DECIDIDO EN RAMA]` tablas `suppliers`, `vehicles`, `drivers`, `motivos`; nombres `cuit_normalized`, `licencia_normalized`, `usuario_id`; alcance EMPRESA y RLS por `empresa_id`; DTOs camelCase sin `empresaId`; permisos suppliers/logistics; search compartido en `packages/contracts/src/search.ts` con `SEARCH_MAX_LIMIT=100`, default 20, `q` trimado y `truncated`; activate/deactivate como POST; `version` en updates; `usuarioId` nullable/preservado si se omite; código/tipo de motivo inmutables; seeds UUID fijos y proveedor faltante intencional. Las tandas siguientes deben respetar estos nombres y el contrato search cuando BE-2 se mergee.
