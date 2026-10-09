# ADR-BE-005 — Mutaciones: idempotencia, concurrencia, transacciones y auditoría

**Estado:** Aceptado. **Fecha:** 2026-10-07. **Resuelve:** decisiones #13, #14, #20 y #22 de [`08_DECISIONES_ABIERTAS.md`](../../../FrontEnd/docs/historial/auditorias/backend/08_DECISIONES_ABIERTAS.md).

**Enmienda a ADRs del frontend:** [ADR-010](../../../FrontEnd/docs/adr/ADR-010-modelo-logistico.md), [ADR-011](../../../FrontEnd/docs/adr/ADR-011-viajes-y-asignacion.md), [ADR-013](../../../FrontEnd/docs/adr/ADR-013-reprogramar-no-entrega.md).

## Contexto

`04_TRANSVERSALES.md` §4, §5 y §15, y `03_REGLAS_DE_NEGOCIO.md` (última sección), encontraron:

- **Reintentos sin idempotencia (A2):** `httpClient` reintenta POST y PUT ante timeout o 5xx (`FrontEnd/src/shared/api/httpClient.ts:250`), y 17 mutaciones no tienen idempotencia. Un pedido lento se duplica.
- **El almacén de idempotencia (A14):**
  - Es un `Map` global, sin alcance ni TTL (`shared/utils/idempotency.ts:24-38`).
  - La clave viaja en el body.
  - En 6 lugares se genera **al enviar**: `TripDetailPanel.tsx:135`, `LogisticsPage.tsx:148`, `DriversPage.tsx:67,75` y `VehiclesPage.tsx:68,80`.
- **Concurrencia (A13):** solo `assignDeliveriesToStop` chequea versión (`trips.service.ts:331`). El resto pisa cambios sin aviso.
- **Transacciones (A11):** `registrarEntrega`, `markStopNoVisitada`, `registerPod` y `reprogramDelivery` son pasos sueltos que pueden dejar estados inconsistentes. Además, los resolvers hacen requests anidados (**M17**).
- **Dos caminos a `FINALIZADO` (A5):** el POD finaliza sin remito (`trips.service.ts:558-560`).
- **Auditoría (A15, parte de auditoría):** ninguna mutación escribe el log genérico (`audit.service.ts:20`), y los historiales por entidad son parciales.

## Decisión

### Idempotencia
- Por header **`Idempotency-Key`, obligatoria en todo POST**, **con una sola excepción: `/auth/*`** (resolución de la objeción 1). Login y logout se pueden repetir sin efecto, y refresh ya tiene rotación y detección de reuso (ADR-BE-003).
- **Alcance:** empresa + usuario + operación + clave, con **hash del payload** y **TTL de 48 h**.

| Situación | Respuesta |
|---|---|
| Misma clave, mismo payload | la respuesta original |
| Misma clave, otro payload | **422** |
| Operación todavía en curso | **409** |

- `httpClient` **reintenta solo GET y mutaciones con clave**.
- La clave se genera al **formar la intención** (ADR-010 §4), también en los 6 lugares que hoy la generan al enviar.

### Concurrencia
- Campo **`version` entero en todo agregado editable**. Viaja en el DTO y es **obligatorio al actualizar**. El conflicto es **409 con la versión actual**.
- Las entidades append-only no lo llevan.

### Transacciones
- **Cada comando es una transacción todo-o-nada que incluye sus efectos cruzados.**
- `markStopNoVisitada` pasa a ser todo-o-nada (**enmienda ADR-013**).
- **Hay un solo camino a `FINALIZADO`: `registrarEntrega`** (remito + líneas del pedido + stock). **El POD es evidencia de esa operación y no finaliza por su cuenta.**
- Consecuencia asumida (resolución de la objeción 2): **el formulario de POD del chofer pasa a incluir las líneas**, con la **cantidad despachada precargada como entregada** (las líneas de la entrega existen desde su creación, ADR-BE-008), así que el chofer solo toca las líneas con novedad. Es un cambio de UI de BE-7.

### Auditoría
Las dos cosas:
- **Los historiales por entidad son parte del modelo.**
- **Además, una tabla genérica** que escribe la infraestructura **en la misma transacción para toda mutación**: quién, cuándo, acción, entidad, id, antes y después, id de request. **Sin borrado.**

## Alternativas descartadas

| Decisión de 08 | Opción descartada | Por qué |
|---|---|---|
| #13 | Clave en el body (el estado actual) | Mezcla un mecanismo de transporte con el payload, y el hash del payload incluiría la propia clave |
| #13 | No reintentar ninguna mutación | Le pierde al chofer con señal intermitente, que es el caso que motivó ADR-010 §4 |
| #14 | `ETag`/`If-Match` | Equivalente en garantía, pero el `version` en el DTO ya existe en `Trip` (`trip.types.ts:99`) y lo usa `CreateTripModal` |
| #20 | Solo historiales por entidad | Deja sin registro a las entidades que no tienen historial (clientes, productos, permisos) |
| #20 | Solo tabla genérica | Pierde los historiales de dominio que la UI ya muestra (`Order.history`, `Delivery.historial`) |
| #22 | Éxito parcial con `resultadosPorEntrega` (ADR-013, enmienda 2026-09-11) | Deja entregas reprogramadas y fuera del viaje sin que la parada cambie |

## Consecuencias para el backend

- **Tabla de idempotencia:** `(empresa_id, user_id, operation, key)` única, más `payload_hash`, `status` (`in_progress|completed`), `response_status`, `response_body`, `expires_at`. Se inserta al empezar el comando, **en la misma transacción**. Un job de Postgres limpia las vencidas (ADR-BE-001: sin infraestructura extra).
- **Versión:** toda tabla de agregado editable tiene `version integer not null default 1`. El `UPDATE … WHERE id = $1 AND version = $2` que no afecta filas → 409 con `details.currentVersion`.
- **Efectos cruzados:** son llamadas a servicios de dominio dentro de la misma transacción, nunca requests HTTP anidados (cierra M17). Desaparecen los `reason` `propagation-failed` y `reprogram-failed` (ADR-BE-004).
- **Auditoría:** un interceptor o hook de repositorio escribe `audit_log (empresa_id, user_id, at, action, entity, entity_id, before, after, request_id)` para toda mutación. La tabla no tiene `UPDATE` ni `DELETE` concedidos al rol de la aplicación.

## Consecuencias para el frontend (al conectar cada módulo)

- **`httpClient`:**
  - Manda `Idempotency-Key` como header en los POST.
  - Deja de reintentar los PUT/PATCH/DELETE, y los POST que no tengan clave.
  - Las mutaciones que hoy mandan `idempotencyKey` en el body dejan de hacerlo.
  - `shared/utils/idempotency.ts` (el `Map`) desaparece del adaptador `http`; queda solo para el mock.
- **Generación de la clave al abrir la acción** en los 6 lugares que hoy la generan al enviar: `TripDetailPanel.tsx:135`, `LogisticsPage.tsx:148`, `DriversPage.tsx:67,75` y `VehiclesPage.tsx:68,80`. Mismo patrón que `RegistrarEntregaModal.tsx:72`.
- **Todo formulario de edición manda la `version` que leyó** y maneja el 409: recarga más aviso. Afecta clientes, productos, proveedores, OC, vehículos y choferes, que hoy no la tienen.
- **`registerPod` deja de finalizar la entrega.** `PodModal` y `TripDetailPanel` pasan a registrar la entrega con `registrarEntrega` (sub-decisión 4). `RegisterPodResult.deliveryFinalized` desaparece.
- `markStopNoVisitada` ya no devuelve éxito parcial: `NoEntregaModal` muestra un solo resultado.

## Hallazgos que cierra

| Hallazgo | Qué era |
|---|---|
| **A2** | reintentos sin idempotencia |
| **A5** | dos caminos a `FINALIZADO` |
| **A11** | pasos no transaccionales |
| **A13** | concurrencia solo en un endpoint |
| **A14** | almacén de idempotencia global; claves generadas al enviar |
| **A15** (parte de auditoría) | ninguna mutación escribe el log genérico |
| **M17** | requests anidados dentro de los resolvers |

## Sub-decisiones (aprobadas 2026-10-08)

1. **"Operación"** del alcance de idempotencia = método + plantilla de ruta (`POST /orders/:id/cancel`), no la URL concreta.
2. **Hash del payload:** SHA-256 del body JSON canonicalizado (claves ordenadas).
3. **`version` en comandos de acción** (POST `/{id}/{accion}`):
   - **Obligatoria** en las acciones que cambian la composición del agregado (`assign-deliveries`, reordenar paradas, editar líneas).
   - **No obligatoria** en las transiciones de estado: su precondición de estado ya detecta el conflicto (pasar de `CREADO` a `EN_TRANSITO` dos veces falla igual por la máquina de estados). Evita 409 espurios en la app del chofer.
4. **POD dentro de `registrarEntrega`:**
   - El comando acepta la evidencia del POD (receptor, firma, imágenes, ubicación) como parte opcional del mismo request. El remito y el POD se graban en la misma transacción.
   - Existe además `POST /delivery-notes/{id}/evidence` para adjuntar evidencia **después** a un remito ya registrado. Eso no cambia ningún estado.
5. **Parada `Visitada`:** pasa a ser **derivada**: todas sus entregas en `FINALIZADO` o `CANCELADO`, o la parada marcada como no visitada. Deja de escribirse por separado (hoy lo hace `registerPod`, `trips.service.ts:562`).
6. **Request id:** lo genera el servidor (UUID v7) por request y lo devuelve en el header `X-Request-Id`. Si el cliente manda uno, se guarda aparte como `client_request_id`.
7. **Antes y después de la auditoría:** JSON completo de la fila, **excluyendo secretos** (hash de contraseña, refresh tokens). Se lee con cursor (ADR-BE-004).
8. **Limpieza de idempotencia:** función SQL ejecutada periódicamente por el propio backend (un scheduler dentro del proceso con un advisory lock, para que corra una sola instancia), sin cron externo.

## Sub-decisiones de BE-0b (tomadas al implementar, 2026-10-08; sin consulta, PROTOCOLO regla 2.9)

9. **Concurrencia con la misma clave: una sola ejecución y la misma respuesta para las dos, no 409.** La clave se registra con `INSERT … ON CONFLICT DO NOTHING` en la transacción del comando. Un segundo request con la misma clave **espera en el índice único** hasta que el primero termina: si confirmó, ve la fila completa y hace replay; si se revirtió, su INSERT entra y ejecuta. Como la clave y la respuesta se escriben en la misma transacción, nunca es visible una clave "en curso". El 409 `idempotency-key-in-progress` queda como defensa, sin camino observable. Por eso la tabla no tiene la columna `status` (`in_progress|completed`) de las consecuencias: `response_status` nulo cumpliría ese papel, pero nunca se ve desde afuera. Probado en `test/db/idempotency.test.ts` (concurrentes).
10. **Toda mutación es un comando:** `CommandInterceptor` (global) abre la transacción con el tenant del actor en todo POST, PUT, PATCH y DELETE fuera de `/auth/*`, y el handler la recibe con `@Command() tx: CommandTx`. Solo POST exige `Idempotency-Key`. La respuesta de un replay lleva el header `Idempotent-Replayed: true` y el status que fija la ruta.
11. **Mecanismo de auditoría: helper de escritura, no hook.** `CommandTx` expone solo lecturas (`select`), `insert`, `update` y `delete` (los dos últimos con versión esperada), y `nextNumber`. Cada escritura deja su registro en `audit_log` en la misma transacción. El cliente Drizzle es privado, `Database.read()` corre en una transacción READ ONLY y ESLint prohíbe fuera de `src/db/` usar `withTenant`, importar `pg` o `drizzle-orm/node-postgres` y usar la reflexión (`Reflect`, `Object.getOwnProperty*`, `.session`). Esto último lo agregó la verificación V2: por reflexión se llegaba a la sesión de Drizzle desde un builder de `select()`. El resto de los caminos (SQL crudo dentro de `src/db/`, o reflexión ofuscada que el lint no ve) queda a la revisión de código.
12. **Actor explícito** (`{ empresaId, userId, requestId }`) con un único punto de entrada, `bindActor`, que en BE-1 llama la autenticación. En BE-0b no lo llama nada de `src/`. `user_id` de `idempotency_keys` y `audit_log` no tiene FK todavía: BE-1 la agrega cuando exista la tabla de usuarios.
13. **Limpieza:** no es una función SQL sino un `DELETE` sin `WHERE` que corre sin tenant y que la política RLS `expired_cleanup` limita a las claves vencidas. Lo dispara un `setInterval` de 15 minutos con `pg_try_advisory_xact_lock` por schema (`IdempotencyCleanupService`). Una clave vencida que todavía no se borró cuenta como inexistente.

## Objeciones

1. **"Idempotencia obligatoria en todo POST" incluye `POST /auth/login`, `/auth/refresh` y `/auth/logout`** (ADR-BE-003). Un login repetido con la misma clave **devolvería la respuesta original, con el token de la primera vez**, y ese token quedaría persistido en la tabla de idempotencia (un secreto guardado fuera de su lugar). Además, la clave forma parte del alcance "usuario", y el usuario todavía no existe antes del login. Escrita tal cual, la regla no aplica a los endpoints de auth. Hace falta una excepción explícita.

   **Resolución (2026-10-08):** **`/auth/*` queda exento de idempotencia.** Login y logout se pueden repetir sin efecto, y refresh ya tiene rotación y detección de reuso. Escrito en la sección Decisión › Idempotencia y en ADR-BE-003 › Consecuencias para el backend. Ningún token queda guardado en la tabla de idempotencia.
2. **"Un solo camino a `FINALIZADO`" contra la Tanda 10B:** hoy el chofer registra el POD por parada (`trips.service.ts:517-567`) y eso finaliza. Con la decisión, el flujo del chofer tiene que cargar cantidades entregadas y rechazadas por línea (`registrarEntrega`), no solo receptor y firma. Es un cambio de UX de la app del chofer que ningún ADR del frontend contempla (ADR-010 §7 trata el POD como evidencia, pero el código de 10B lo usa como finalización).

   **Resolución (2026-10-08):** **un solo camino a `FINALIZADO`, confirmado.** El formulario de POD del chofer pasa a incluir las líneas, con la **cantidad despachada precargada como entregada**, así que el chofer solo toca las líneas con novedad (lo rechazado o lo que no entró). La precarga es posible porque la entrega tiene líneas con cantidad despachada desde que se crea (ADR-BE-008, resolución de su objeción 1). Es un **cambio de UI que se hace al conectar logística (BE-7)**, anotado en el plan de tandas del README.
3. **Reintento de PUT con clave (objeción nueva, BE-0b, 2026-10-09; abierta, resolver antes de BE-2).** El §Decisión dice "`httpClient` reintenta solo GET y mutaciones con clave", y BE-0b lo implementó así (POST/PUT/PATCH/DELETE con `idempotencyKey` se reintentan). Pero las consecuencias para el frontend dicen "deja de reintentar los PUT/PATCH/DELETE", y el backend de BE-0b solo deduplica por clave los POST. Hoy no hay daño, porque el frontend sigue sobre el mock y su `withIdempotency` deduplica también los PUT. Al conectar un módulo, en cambio, un PUT reintentado tras un timeout cuya primera ejecución sí se confirmó no duplica el efecto (la versión o la máquina de estados lo frenan), pero le devuelve al usuario un 409 o un 422 espurio. Hay dos salidas: (a) el backend honra `Idempotency-Key` también en PUT/PATCH/DELETE cuando viene, o (b) el frontend no reintenta las mutaciones que no son POST, como dicen las consecuencias.
