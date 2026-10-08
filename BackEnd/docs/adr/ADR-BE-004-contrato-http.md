# ADR-BE-004 — Contrato HTTP: ids, DTO, fechas, paths, errores, paginación

**Estado:** Aceptado. **Fecha:** 2026-10-07. **Resuelve:** decisiones #3, #4, #12 y #15 de [`08_DECISIONES_ABIERTAS.md`](../../../FrontEnd/docs/historial/auditorias/backend/08_DECISIONES_ABIERTAS.md).

**Enmienda a ADRs del frontend:** [ADR-006](../../../FrontEnd/docs/adr/ADR-006-ids-tipados.md), [ADR-015](../../../FrontEnd/docs/adr/ADR-015-estado-activo-en-altas.md), [ADR-016](../../../FrontEnd/docs/adr/ADR-016-filtro-estado-server-side.md). Reescribe la regla 3.1 del protocolo.

## Contexto

La auditoría (`01_ENDPOINTS.md`, `04_TRANSVERSALES.md`) encontró:

- **Ids (B8):** se generan con `Date.now()` en el mock y ADR-006 los valida **por prefijo** (`FrontEnd/src/shared/types/ids.types.ts:61-72`).
- **Wire (B4):** 59 de 91 respuestas devuelven el tipo de dominio del frontend. 28 tienen DTO en snake_case. Conviven 2 envoltorios de página (01 C-4/C-5).
- **Errores (B6):**
  - En modo `http` el cuerpo de error se descarta (`httpClient.ts:188-190`).
  - Conviven 15 `throw ApiError` con texto y uniones `{success:false, reason}` devueltas con 2xx.
  - 8 toasts que muestran `err.message` cambiarían de texto (**A12**).
- **Paginación:** offset en 19 listados y cursor en 1, contra la regla 3.1 ("cursor por defecto"). Ningún resolver acota `pageSize` (**M3**, **M20**). Hay 13 listas sin límite (01 C-6).
- **Paths (M4):**
  - Verbos en el path y mezcla de idiomas.
  - 4 convenciones de transición distintas.
  - `GET /suppliers` con dos contratos (**M6**).
- **Orden:** no viaja en 17 exports y listados (**M1**). `exportSuppliers` recorta en el cliente (**M2**).
- **Formatos (M14):** fechas en formatos de display (`'Hace 5 min'`, `dd/MM/yyyy`, una hora sin fecha).
- **Remitos (A10):** no tienen endpoint (`deliveries.service.ts:652`, leído por un componente).

## Decisión

### Ids
- **UUID v7, generado por el servidor.** ADR-006 conserva los branded types (`OrderId`, `ClientId`…) y **cambia la validación por prefijo por validación de formato**.
- Los números legibles (`PED-000123`) son **campos aparte** (ADR-BE-006).

### DTO
- **DTO explícito para todos los recursos**, definido en `packages/contracts` (ADR-BE-001).
- JSON en **camelCase, con los nombres de campo de los tipos de dominio actuales**. Los 28 DTO en snake_case se migran al conectar cada módulo.
- **La base usa el mismo vocabulario en snake_case, sin traducir** (`Order.clientName` → `orders.client_name`).
- **Los campos existentes no se renombran** (resolución de la objeción 1). Dos reglas para que la mezcla de idiomas no empeore:
  1. **Un campo nuevo usa el idioma de los demás campos de su entidad.** (`Trip` sigue en español, `Order` en inglés.)
  2. **Ningún valor de enum es texto de display.** Todo valor de enum es un **código kebab-case**; el texto lo arma la UI.
- Los campos que calcula el servidor (`allowedTransitions`, `capacidadUsada`, `sobrecargado`) **son parte del DTO, de solo lectura**.

### Fechas
- Instantes en **ISO 8601 UTC**. Fechas sin hora como **`yyyy-MM-dd`**.
- La empresa tiene **zona horaria** para resolver "hoy".
- **Ningún texto de display viaja como dato.** Eso incluye los valores de enum y el `motivo` de `allowedTransitions`, que pasan a ser códigos (resolución de las objeciones 1 y 2).

### Paths
- Sustantivos en **plural y kebab-case**.
- Las acciones son **`POST /{recurso}/{id}/{accion}`**, con **una sola convención de transición** para todos los recursos.

### Errores
- **4xx con cuerpo `{ code, message, details? }`:**

| Status | Cuándo |
|---|---|
| 400 | validación |
| 401 | sin sesión |
| 403 | sin permiso |
| 404 | no existe |
| 409 | conflicto de versión o de concurrencia |
| 422 | regla de negocio |

- `code` es un **vocabulario único en kebab-case**.
- **`httpClient` pasa a leer el cuerpo de error**, y el adaptador `http` traduce `code` a las uniones `{ success:false, reason }` que ya usa la UI, **para que la UI no cambie**.

### Paginación
- **Offset**, con `total` y **`pageSize` máximo de 100**, para maestros y documentos.
- **Cursor obligatorio** para los registros append-only: movimientos de stock, historial de producto, auditoría, alertas, movimientos de caja y de cuenta corriente.
- Un envoltorio por tipo: `{ items, total, page, pageSize, aggregates? }` y `{ items, nextCursor, aggregates? }`.
- La regla 3.1 se reescribe con este criterio.

### Orden y filtros
- **Orden y filtros viajan siempre en el request**, contra una **lista blanca por recurso** definida en `contracts`.
- **No existen listas sin límite:** las 13 actuales pasan a paginadas o a búsqueda acotada (ADR-016).

## Alternativas descartadas

| Decisión de 08 | Opción descartada | Por qué |
|---|---|---|
| #3 | **A. String con prefijo** (`ord-…`) como PK | Prefijo en la PK de Postgres, generación propia propensa a colisiones (hoy `Date.now()`), y "prefijo = tipo" se puede reemplazar por el branded type del compilador |
| #3 | UUID v4 | Sin orden temporal: peor localidad de índice en tablas append-only y ningún orden natural para el cursor |
| #4 | Mantener el dominio como wire sin DTO | Ata el servidor al modelo interno del frontend: es el hallazgo B4 |
| #4 | snake_case en el wire | Exige mappers en los dos lados para siempre. Los 28 DTO en snake_case son minoría frente a 59 en camelCase |
| #12 | **A. `200` con `{success:false, reason}`** | Atípico para proxies, logs y monitoreo, y mezcla éxito con fracaso en el mismo status |
| #15 | **B. Solo offset** | Contradice la regla 3.1 y no escala en registros append-only de alto volumen |
| #15 | Cursor para todo | Los maestros necesitan `total` y saltos de página que la UI ya ofrece (`Pagination.tsx`) |

## Consecuencias para el backend

- `packages/contracts` define, por recurso: DTO de lectura, DTO de comando, lista blanca de filtros y orden, `pageSize` máximo y vocabulario de `code`.
- Un filtro de excepciones único traduce cada error de dominio a status + `{code, message, details}`. Las uniones de `reason` actuales se mapean 1:1 a `code` (tabla en la sub-decisión 3).
- Los 13 endpoints "lista" se rediseñan:
  - Catálogos de selector → búsqueda acotada (ADR-016).
  - `getPurchaseOrdersBySupplierId` y `getDeliveriesForOrder` → paginados.
  - Catálogos de tamaño fijo por diseño → límite fijo documentado (sub-decisión 6).
- `GET /suppliers` deja de tener dos contratos: el catálogo para selectores es la búsqueda acotada.
- Los remitos pasan a tener endpoint (sub-decisión 7).

## Consecuencias para el frontend (al conectar cada módulo)

- **`ids.types.ts`:** los constructores validan formato UUID en vez de prefijo. **Los seeds del mock usan prefijos** (`ord-001`, `cli-001`…). Ver sub-decisión 1 sobre la transición.
- **`httpClient.runHttp`** lee el cuerpo de los 4xx y arma `ApiError` con `code`, `message` y `details`. El adaptador de cada service traduce `code` a la unión `reason` que ya consume la UI. Los 8 toasts que muestran `err.message` reciben el `message` del servidor.
- **DTO:** los 28 snake_case se reemplazan por los de `contracts` (camelCase). Los 59 que hoy son dominio pasan a tener DTO explícito, aunque la forma no cambie.
- **Exportaciones y listados** mandan `sortField`/`sortDirection` (17 casos de M1). `exportSuppliers` deja de recortar en el cliente.
- **Listados con cursor:**
  - Pasan a cursor: `TabMovements`, `TabProductHistory`, `AuditLogWidget` y `CashTransactionsTable`. `AlertsBell` ya usa cursor.
  - Cambian de componente de paginación: "anterior/siguiente" en lugar de números de página.
  - El cursor vive en la URL (regla 3.8).
- **Valores de enum que pasan a código** (resolución de la objeción 1): `ClientAccount.status: 'Al dia' | 'Con Deuda'` → `'al-dia' | 'con-deuda'` (`client.types.ts:95`). La tabla de clientes arma el texto y el color desde el código. Mismo criterio para cualquier otro enum con texto de display que aparezca al conectar un módulo.
- **`allowedTransitions[].motivo` pasa a `motivoCode`** (resolución de la objeción 2): el servidor manda el código y la UI arma el texto. `DeliveriesTable` y los paneles de viaje leen el código, nunca una frase. Anotado en la enmienda de ADR-010 (§3).
- **Paths que cambian:**
  - Transiciones y acciones: `/advance`, `/cancel`, `/reprogram`, `/assign`, `/no-visitada`, `/toggle-activo`, `/read` → `POST /{recurso}/{id}/{accion}` en kebab-case e inglés.
  - Español: `/posicion` → `/position` (`TripPosition`), `/recorrido` → `/route` (`getTripRoute`). `/motivos` se mantiene (`MotivoCatalogItem`).

## Hallazgos que cierra

| Hallazgo | Qué era |
|---|---|
| **B4** | wire indefinido |
| **B6** | rechazos con dos mecanismos; cuerpo de error descartado |
| **B8** | formato de ids |
| **A10** | remitos sin endpoint |
| **A12** | toasts con texto genérico en `http` |
| **M1** | orden que no viaja |
| **M2** | `exportSuppliers` recorta en el cliente |
| **M3** | listas sin límite; `pageSize` sin tope |
| **M4** | verbos en el path, idiomas, convenciones de transición |
| **M6** | dos contratos en `GET /suppliers` |
| **M14** | formatos no ISO |
| **M20** | cursor de alertas sin tope |
| **L4** | vocabulario de `reason` inconsistente |

## Sub-decisiones (aprobadas 2026-10-08)

1. **Transición de ids en el frontend:** mientras un módulo siga corriendo sobre el adaptador mock, su constructor acepta **UUID o el prefijo legado**. El prefijo se elimina cuando el último módulo esté conectado. Alternativa: convertir los seeds a UUID. Se eligió la transición para no reescribir 17 archivos de mock en la tanda de cada módulo.
2. **Convención única de acciones:** el segmento `{accion}` es un **verbo en inglés kebab-case**.
   - Las máquinas de estado genéricas usan la acción **`transition`** con body `{ to }`: entrega, viaje y orden de compra.
   - Las acciones con semántica propia tienen su verbo: `cancel`, `confirm`, `reschedule`, `assign-deliveries`, `mark-not-visited`, `receive`, `activate`/`deactivate`, `mark-read`.
3. **Tabla `reason` → `code` → status** (extracto):

| `reason` actual | `code` | Status |
|---|---|---|
| `not-found`, `order-not-found`, `delivery-not-found`, `vehicle-not-found`, `client-not-found`, `product-not-found` | `not-found` (+ `details.entity`) | 404 |
| `stale-version` | `version-conflict` (+ `details.currentVersion`) | 409 |
| `invalid-transition`, `terminal-status`, `invalid-status-for-cancel` | `invalid-transition` | 422 |
| `has-active-deliveries`, `inactive-client`, `inactive-product`, `order-not-confirmado`, `exceeds-capacity`, `exceeds-limit`, `motivo-invalido`, `motivo-requerido`, `patente-duplicada`, `no-lines`, `no-items`, `invalid-line`, `invalid-supplier`, `stops-mismatch`, `trip-not-en-curso`, `stop-not-pendiente`, `no-deliveries`, `delivery-en-estado-terminal` | el mismo texto en kebab-case | 422 |
| `propagation-failed`, `reprogram-failed` | **desaparecen**: el comando es una transacción (ADR-BE-005) | — |

   La traducción inversa (`code` → `reason`) se hace en el adaptador de cada módulo. Los `*-not-found` vuelven a su nombre original según la entidad.
4. **Zona horaria de la empresa:** campo IANA (`America/Argentina/Cordoba`) en la empresa. "Hoy" y los rangos `dateFrom`/`dateTo` se resuelven en esa zona en el servidor.
5. **Cursor:** opaco (base64url de `(timestamp, id)` del último elemento). Se apoya en el orden temporal de UUID v7 más la columna de fecha de negocio.
6. **Catálogos de tamaño fijo:** motivos, roles y permisos, y el recorrido del viaje (`MAX_ROUTE_POINTS`) llevan un **límite fijo documentado en `contracts`**, en vez de paginación. Siguen sin ser "listas sin límite".
7. **Remitos:** `GET /deliveries/{id}/delivery-notes` (cierra A10). Se lee con el detalle de la entrega.
8. **El nombre del recurso sale del tipo de dominio**, en plural y kebab-case, sin traducir: `orders` (`Order`), `deliveries` (`Delivery`), `trips` (`Trip`), `motivos` (`MotivoCatalogItem`), `client-accounts` (`ClientAccount`).

## Objeciones

1. **"camelCase con los nombres de campo de los tipos de dominio actuales" congela un vocabulario mezclado.** En la misma entidad conviven inglés y español: `Trip.estado/paradas/fecha` contra `Order.status/date` (`trip.types.ts:87-114`, `order.types.ts:66-86`). También hay nombres de display como valor de enum (`ClientAccount.status: 'Al dia' | 'Con Deuda'`, `client.types.ts:95`). La decisión los traslada al wire y a la base tal cual, así que la mezcla queda permanente.

   **Resolución (2026-10-08):** **no se renombran los campos existentes.** Renombrar no cambia ningún comportamiento y obliga a escribir mappers para 59 endpoints. La mezcla de idiomas queda, acotada por dos reglas que evitan que empeore (sección Decisión › DTO): un campo nuevo usa el idioma de los demás campos de su entidad, y **ningún valor de enum es texto de display**. Los valores como `'Al dia'` o `'Con Deuda'` pasan a códigos kebab-case (`al-dia`, `con-deuda`) y el texto lo arma la UI.
2. **"Ningún texto de display viaja como dato" choca con `allowedTransitions[].motivo`**, un texto en español armado en el cliente (`deliveryStatus.types.ts:42-48`, `tripStatus.types.ts:34-40`). Si viaja en el DTO, es texto de display. Con la decisión tal cual, el motivo tendría que ser un `code` y el texto lo arma la UI.

   **Resolución (2026-10-08):** **`allowedTransitions[].motivo` pasa a ser un `code` kebab-case** (`motivoCode`); el texto lo arma la UI. Queda anotado en la sección de enmienda de ADR-010, que es donde vive la forma de `allowedTransitions` (**§3** de ese ADR, no §1: ver la objeción 3).

3. **La consigna de cierre ubica `allowedTransitions` en el §1 de ADR-010, y está en el §3.** El §1 de ADR-010 es "Ejes de estado"; `allowedTransitions` y su forma `{ transicion, permitida, motivo? }` son el §3, "Eventos append-only y proyección" (`FrontEnd/docs/adr/ADR-010-modelo-logistico.md:107` y la decisión aprobada 3 de ese ADR). La enmienda se escribió contra **§3**, que es la sección real. Diferencia de referencia, no de contenido. **Objeción nueva, anotada al aplicar la resolución.**
