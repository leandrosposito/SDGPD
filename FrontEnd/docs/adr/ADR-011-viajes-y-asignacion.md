# ADR-011 — Viajes, capacidad y motor de asignación

**Estado:** Aceptado (2026-09-09, con las correcciones de la revisión del 2026-09-09 aplicadas — ver cada sección). **Fecha:** 2026-09-09. Depende de ADR-010 (asume que existen `Viaje`/`Parada` tal como los define ese ADR, ya aprobado con sus propias correcciones el mismo día).

## Problema

Agrupar pedidos preparados en viajes con vehículo y chofer, sin romper las reglas de escalabilidad del protocolo (`docs/PROTOCOLO.md`, sección 3) — en particular, sin repetir el antipatrón que `AUDIT_15_LOGISTICA.md` ya confirmó que el proyecto evita en todos lados: nunca traer una colección completa al cliente para que la procese ahí.

---

## 1. Selección por filtro, no por lista de IDs

### Opción A — El request acepta dos modos: lista explícita o filtro+exclusiones

```
POST /viajes/{id}/asignar
{ modo: 'lista', ids: OrderId[] }
  | { modo: 'filtro', filtros: {...mismos filtros del listado...}, excluidos: OrderId[] }
```

En modo `filtro`, el servidor resuelve la asignación aplicando el MISMO filtro que ya usa el listado paginado (reusa el filtro, no lo reinterpreta), resta `excluidos` (los que el usuario destildó a mano de la selección visible), y aplica el resultado — **nunca mandando 3.000 IDs por la red**, el cliente solo manda el filtro + un puñado de exclusiones puntuales. **Techo duro:** un límite (`MAX_ASSIGNMENT_ROWS`, constante nombrada — mismo criterio que `MAX_EXPORT_ROWS = 10_000` en `pagination.types.ts:74`, pero un valor propio y más chico, ver más abajo) — si el filtro matchea más que el techo, el servidor **no asigna nada** y devuelve `{ success: false, reason: 'exceeds-limit', matched: N, limit: MAX_ASSIGNMENT_ROWS }`; el cliente muestra "tu filtro trae {N} pedidos, el máximo por asignación es {limit} — acotá el filtro" en vez de asignar parcialmente sin que el usuario lo pida explícitamente.

**Por qué el techo es MÁS chico que `MAX_EXPORT_ROWS`, no el mismo valor:** exportar es una operación de lectura (arma un archivo); asignar es una escritura real por fila (valida capacidad, marca el pedido, genera Parada) — el costo por fila es mayor y el radio de un error es mayor (10.000 asignaciones mal hechas por un filtro too-amplio son 10.000 correcciones manuales). **Corrección de la revisión 2026-09-09 (valor del techo):** `MAX_ASSIGNMENT_ROWS` queda del **orden de 100**, no 500-1.000 — un camión hace 40-60 paradas en un día real, un techo de 1.000 no protege contra nada porque ningún viaje real se acerca a ese número; 500-1.000 solo tendría sentido si esta operación sirviera para OTRA cosa. Y sirve para otra cosa: **"planificar 800 pedidos en N viajes" es una operación distinta y futura (armado automático de viajes), no el mismo endpoint de asignación con un número más grande** — queda escrito así explícitamente para que una tanda futura no intente resolver el armado automático subiendo este techo en vez de diseñando el endpoint que le corresponde.

**Ventaja:** un filtro de "toda la zona Norte de hoy" se resuelve en un request, sin importar si son 30 o 3.000 pedidos, con un techo explícito que evita el caso patológico. **Costo:** el servidor necesita poder re-ejecutar el mismo filtro dos veces (una para contar/mostrar el preview antes de confirmar, otra para aplicar) de forma consistente — si el conjunto cambia entre el preview y la confirmación (alguien más asignó uno de esos pedidos mientras tanto), hace falta manejarlo (ver sección 3, concurrencia).

### Opción B — Solo lista explícita de IDs, sin modo filtro

Descartada explícitamente por el problema planteado: con miles de pedidos paginados, no hay forma de que el cliente arme esa lista sin traer todo a memoria primero — exactamente lo que las reglas de escalabilidad prohíben.

### Opción C — El servidor pagina la operación de asignación en lotes automáticos (el cliente no ve el techo, el servidor trocea internamente)

Más "mágico" para el usuario (nunca ve un error de límite), pero esconde una operación de escritura masiva detrás de una sola confirmación de UI — si algo falla a la mitad, el usuario no sabe cuántas de las 3.000 realmente se aplicaron sin un mecanismo de progreso adicional. **Descartada:** el techo explícito (Opción A) es más honesto y más simple de implementar primero; el troceo automático es una mejora de UX que se puede agregar DESPUÍS sin cambiar el contrato (el modo `filtro` se mantiene igual, solo cambia qué hace el servidor puertas adentro).

**Recomendación: Opción A.**

---

## 2. Capacidad multidimensional

### Opción A — Validación server-side en cada alta/baja del viaje; el cliente solo lee `capacidadUsada`/`capacidadTotal`

`Viaje` expone `capacidad: { bultos, pesoKg, volumenM3, pallets, restricciones: string[] }` (definida por el vehículo asignado) y `capacidadUsada` del mismo shape, **recalculada server-side en cada `POST /viajes/{id}/paradas`** (agregar) y `DELETE` (quitar) — nunca sumada en el cliente sobre la colección de pedidos del viaje. La UI muestra una barra/resumen con lo que el endpoint ya le da.

**Qué pasa cuando un pedido no entra — 3 sub-opciones, una elegida por Leandro:**
- **A1. Error duro:** el servidor rechaza el alta (`{ success: false, reason: 'exceeds-capacity', detalle }`), el pedido no se agrega. Requiere que el usuario mueva el pedido a otro viaje o lo deje sin asignar.
- **A2. Warning override-able:** el servidor permite agregar igual si el request trae `{ forzar: true, motivo: string }` (**corrección de la revisión 2026-09-09: `motivo` es obligatorio en el override, no opcional** — sin una razón registrada, el warning es cosmético, no una decisión auditable), pero el Viaje queda marcado `sobrecargado: true` (visible en el listado de viajes) y el override queda registrado como evento de auditoría con **quién** (usuario), **cuándo** (timestamp) y **por qué** (el `motivo` del request) — distinto de "por cuánto se excedió" (el delta numérico entre capacidad y uso, que el servidor calcula solo, no lo escribe el usuario). Los tres datos (quién/cuándo/por qué) son los que dan flexibilidad operativa real (un vehículo a veces sí puede llevar un poco más de lo nominal) sin perder trazabilidad de que fue una decisión humana consciente y justificada, no un click apurado.
- **A3. Split automático del viaje:** el sistema arma un segundo viaje solo para el excedente. **Descartada de entrada** (no una sub-opción real): partir automáticamente implica decidir vehículo/chofer para el viaje nuevo, una decisión de negocio que el sistema no puede tomar solo.

**Recomendación: A2 (warning override-able)** — es el balance entre no bloquear operación real (los números "nominales" de un vehículo casi siempre tienen margen real) y no perder el registro de que alguien decidió exceder el límite a propósito.

### Opción B — Validación client-side, sumando sobre `viaje.paradas` ya cargado

Descartada explícitamente por el protocolo: es exactamente "agregado calculado en el cliente sobre una colección completa" (regla de escalabilidad #2) — con un viaje de cientos de paradas, sumar en el navegador cada vez que se agrega una más es trabajo repetido e innecesario que además puede desincronizarse de lo que el servidor considera válido.

**Recomendación: Opción A, con la sub-opción A2.**

---

## 3. Concurrencia

### Opción A — Control optimista con versión/ETag, `409` al asignar

Cada `Order`/`Parada` expone una versión (`etag` o `version: number`, incrementada en cada escritura). El request de asignación incluye la versión que el cliente tenía al momento de decidir asignar; si no coincide con la actual para alguno de los pedidos del lote (alguien más lo asignó/modificó mientras tanto), el servidor devuelve `409 Conflict`. **Corrección de la revisión 2026-09-09 (granularidad del 409, aplica sobre todo al modo `filtro` de la sección 1, donde el lote puede tener decenas de pedidos):** el `409` no es un error genérico de "algo falló" — el cuerpo de la respuesta dice explícitamente **qué pedidos** (`orderId[]`) perdieron la carrera y **a qué viaje** los tomó cada uno (`asignadoAViajeId` por pedido en conflicto), y el servidor **aplica igual la asignación de los pedidos que SÍ seguían libres** — el conflicto de una fila no descarta el lote completo. El cliente muestra: **"3 de los 40 pedidos ya fueron asignados a otro viaje mientras confirmabas — se listan abajo; los 37 restantes se asignaron"**, saca esas filas puntuales de la selección, y **refetchea la lista** para reflejar el estado real (no reintenta a ciegas con la versión vieja).

**Ventaja:** simple, sin locks, mismo patrón que HTTP ya estandariza (ETag/If-Match) — no hace falta inventar nada nuevo. **Costo:** cada entidad mutable de este dominio necesita un campo de versión que hoy no tiene ninguna (`Delivery`/`Order` actuales no versionan) — cambio de esquema, no solo de lógica.

### Opción B — Lock pesimista (el usuario "reserva" el pedido al abrir el panel de asignación)

Descartada: requiere una sesión de "edición en curso" con expiración, liberación al cerrar/desconectar, y UI para mostrar "Fulano lo tiene abierto ahora mismo" — mucha más complejidad que el problema real justifica para una operación que dura segundos, no minutos.

**Recomendación: Opción A.**

---

## 4. Tiempo real y GPS

### Opción A — Dos endpoints separados: última posición (para el mapa) y recorrido histórico (aparte, simplificado)

- **`GET /viajes/{id}/posicion`**: un solo punto `{ lat, lng, timestamp }`, consumido por `useLiveQuery` con un intervalo de **10-15s** (no los 30s por defecto — ver la enmienda 2026-09-09 de ADR-003, que agrega esta posibilidad puntualmente para este consumidor) — payload mínimo, sin importar cuánto lleve recorrido el viaje.
- **`GET /viajes/{id}/recorrido`**: endpoint aparte, bajo demanda (no polling), que devuelve el recorrido histórico **ya simplificado server-side** (decimado — un punto cada N metros/segundos, no cada punto crudo del GPS) con un **techo explícito de puntos, `MAX_ROUTE_POINTS = 500`** (constante nombrada, valor decidido en la revisión 2026-09-09). Nunca se manda al navegador la traza cruda del GPS (que en un viaje de horas puede ser miles de puntos).

**Ventaja:** el mapa en vivo nunca paga el costo del historial completo, y el historial (cuando alguien lo pide) tiene un techo conocido. **Costo:** el servidor necesita un algoritmo de simplificación de ruta (aunque sea simple — un punto cada N segundos, sin necesidad de Douglas-Peucker real para la primera versión).

### Opción B — Un solo endpoint que devuelve todo el recorrido acumulado, el mapa se queda con el último punto

Descartada: el polling de 30s repetiría cada vez una lista creciente de puntos (peor cuanto más avanza el día) — exactamente el patrón que A3 (paginación) de la corrida completa ya identificó como riesgo.

**Recomendación: Opción A.**

---

## 5. Secuencia de paradas

### Opción A — Orden manual (drag/reorder), detrás de una interfaz que un optimizador externo pueda implementar después

`Parada.orden: number` (o posición en un array ordenado), editable a mano por el operador (arrastrar filas). La función que decide el orden se aísla detrás de una interfaz (`ordenarParadas(paradas): Parada[]`) cuya única implementación hoy es "devolver el array en el orden que el usuario ya fijó a mano" — un botón "Optimizar ruta" (deshabilitado o ausente en esta primera versión) es, a futuro, otra implementación de la misma interfaz que llama a un servicio externo y reordena. **Nunca se optimiza en el cliente** (ni siquiera un algoritmo simple de vecino más cercano) — si el botón se habilita antes de tener un servicio real, debe llamar a un endpoint propio, no calcular en el navegador.

**Ventaja:** no bloquea la operación real esperando un optimizador que no existe todavía, y no cierra la puerta a enchufarlo después sin tocar componentes (la UI de reordenar a mano sigue funcionando igual, el botón nuevo es aditivo). **Costo:** ninguno adicional — es el camino más simple que además dejo bien encaminado.

**Corrección de la revisión 2026-09-09 (sin ETA inventado):** con orden manual, el sistema **no calcula ni muestra una hora estimada de llegada (ETA) por Parada** — no hay ningún dato real (tráfico, velocidad, distancia real de ruta) del que derivar una estimación honesta, y "adivinar" un ETA a partir del orden y una velocidad promedio inventada sería mostrarle al usuario un número con apariencia de dato real que en realidad es una suposición sin base. Es mejor no mostrar ETA que mostrar uno que sistemáticamente se equivoca y erosiona la confianza en toda la pantalla. Esto se reevalúa naturalmente el día que exista un optimizador real (Opción B descartada más abajo) que sí calcule tiempos con datos reales de ruta.

### Opción B — Optimización automática desde el día uno (algoritmo propio o servicio externo ya integrado)

Descartada por alcance: integrar un optimizador de rutas real (con restricciones de ventana horaria, tráfico, capacidad) es un proyecto en sí mismo, no una decisión de modelado — fuera de lo que este ADR puede/debe resolver. Se dimensiona cuando haya una decisión de negocio de qué servicio usar (costo, dependencia externa — prohibida sin autorización explícita, regla 2 del protocolo).

**Recomendación: Opción A.**

---

## 6. Ventanas horarias

### Problema de modelado adicional, no solo de decisión

`ClientAccount` (`client.types.ts:51-66`) tiene un único campo `address: string` — no existe hoy ninguna relación cliente↔sucursal ni múltiples direcciones por cliente (confirmado: no hay ningún campo de dirección secundaria ni tabla de relación en el tipo actual). Esto acota las opciones reales:

### Opción A (original, ya NO recomendada) — Ventana horaria + días de visita como campos planos en `ClientAccount`

`ventanaDesde`/`ventanaHasta` (hora) + `diasVisita: DiaSemana[]`, directo y sueltos en el cliente. **Descartada en la revisión 2026-09-09** — ver Opción C, que la reemplaza como recomendación.

### Opción C — Ventana horaria + días de visita como objeto anidado `preferenciasEntrega` en `ClientAccount`

**Cambio de recomendación de la revisión 2026-09-09.** Mismos datos que la Opción A (`ventanaDesde`/`ventanaHasta`/`diasVisita`), pero agrupados bajo un único campo `preferenciasEntrega: { ventanaDesde, ventanaHasta, diasVisita } | null` en vez de 3 campos sueltos al mismo nivel que `address`/`clientName`/etc. **Razón del cambio:** hoy existe una contradicción abierta (no resuelta por ningún ADR) sobre si multi-dirección es alcance MVP o una etapa de crecimiento para `Client` — campos planos como `ventanaDesde` cementan el supuesto de "una sola dirección, una sola ventana" en un TERCER lugar del código (además de `address: string` y de cualquier otro sitio que ya asuma dirección única), cada uno un punto más para migrar el día que ese supuesto cambie. Con `preferenciasEntrega` como objeto anidado, el día que aparezca multi-dirección la migración es mover UN objeto (colgarlo de la dirección en vez de colgarlo del cliente) en vez de encontrar y mover 3 campos sueltos — logística no se entera del cambio de estructura interna mientras sigue leyendo `cliente.preferenciasEntrega`.

El motor de asignación (ADR-010/011) los lee igual que en la Opción A: como **restricción blanda** (warning si se intenta asignar una Parada fuera de la ventana o un día no habilitado), no un bloqueo duro — un distribuidor real a veces entrega fuera de ventana por acuerdo puntual con el cliente, bloquear duro sería más rígido de lo que el negocio necesita.

**Costo:** el mismo que la Opción A en esencia (si en el futuro un cliente tiene múltiples direcciones con ventanas distintas, `preferenciasEntrega` se mueve a esa relación nueva) — la diferencia es que ese costo se paga en un solo lugar (mover un objeto) en vez de tres (tres campos sueltos a rastrear y mover uno por uno).

### Opción B — Esperar a que exista una relación cliente-sucursal antes de modelar ventanas horarias

Más "correcta" en abstracto, pero bloquea la capacidad completa (ninguna ventana horaria) hasta que se resuelva un modelado que ningún ADR pidió resolver todavía. **Descartada** por alcance — no es este ADR el lugar para decidir si `Client` necesita multi-dirección.

**Recomendación: Opción C**, documentando explícitamente el costo de migración futura si el modelo de cliente cambia (menor que en la Opción A original, por estar agrupado en un solo campo).

---

## 7. Documentos impresos

### Opción A — Mismo patrón que exportación (ADR-004): job server-side + polling + descarga

Hoja de ruta y remitos se generan igual que cualquier export del proyecto (`ExportButton`, `exportJobs.ts`, `buildExportFile.ts` ya existentes) — un job asíncrono que arma el documento del lado del servidor (o del mock, simulando servidor), el cliente hace polling de su estado, y descarga el archivo terminado. **Nunca PDF armado en el navegador** (regla de escalabilidad #3, ya vigente para todo el resto del proyecto).

**Corrección de la revisión 2026-09-09 (reproducibilidad):** a diferencia de un export de listado (que legítimamente refleja "el estado de hoy" cada vez que se corre), un remito o una hoja de ruta ya emitidos son **documentos legales/operativos que tienen que poder volver a descargarse idénticos** — si alguien pide de nuevo el remito de una entrega de la semana pasada, tiene que ver EXACTAMENTE lo que se generó esa vez (mismas cantidades, mismo texto de motivo, mismo estado), no una regeneración con los datos actuales (que pudieron cambiar: un motivo editado en el catálogo, un remito con una línea que después se ajustó). El job de generación **snapshotea los datos al momento de la emisión** (o el resultado ya generado se persiste tal cual, no se recalcula en cada descarga) — pedir el mismo documento dos veces devuelve el mismo contenido las dos veces, sin importar qué cambió en el sistema entre medio.

**Costo:** el generador de PDF (hoja de ruta con mapa/lista de paradas, remito con líneas y totales) es lógica nueva del lado del "servidor" (mock) — no existe hoy ningún generador de PDF en el proyecto (los exports actuales son Excel/CSV vía `xlsx`, no PDF). Puede requerir evaluar una librería de generación de PDF — **si la requiere, es una dependencia nueva, prohibida sin autorización explícita (regla 2 del protocolo)** — se deja como costo a confirmar en la tanda de implementación, no se resuelve acá.

### Opción B — Generación en el navegador (`window.print()` o una librería de PDF client-side)

Descartada explícitamente por el enunciado del problema y por la regla de escalabilidad #3 ya vigente — el mismo patrón que ya se prohibió para exports de listados se prohíbe acá por la misma razón (documento generado sin límite de tamaño controlado, trabajo repetido en cada dispositivo en vez de una vez server-side).

**Recomendación: Opción A**, con el costo de la librería de PDF marcado explícitamente como pendiente de decidir (puede resolverse sin dependencia nueva si el "PDF" del mock es en realidad HTML imprimible servido como blob — a evaluar en implementación, no acá).

---

## Decisiones — APROBADAS 2026-09-09 (con correcciones aplicadas en cada sección)

1. **Selección por filtro con techo duro (`MAX_ASSIGNMENT_ROWS`), además de lista explícita.** — **Aprobado: Opción A (sección 1), con corrección: el techo queda en el orden de 100 (no 500-1.000)** — "planificar cientos de pedidos en N viajes" es una operación futura distinta, no este mismo endpoint con un número más grande.
2. **Capacidad validada 100% server-side, con warning override-able (no error duro, no split automático) cuando un pedido no entra.** — **Aprobado: sub-opción A2 (sección 2), con corrección: el override exige `motivo` obligatorio y queda auditado con quién/cuándo/por qué**, no solo quién/cuándo/por-cuánto-se-excedió.
3. **Control optimista con versión/ETag y `409` en vez de lock pesimista.** — **Aprobado: Opción A (sección 3), con corrección: el `409` es granular** — informa qué pedidos puntuales del lote se perdieron y a qué viaje, y el servidor aplica igual la asignación de los que seguían libres, no descarta el lote completo.
4. **Separar "última posición" (polling, liviano) de "recorrido histórico" (bajo demanda, simplificado con techo de puntos).** — **Aprobado: Opción A (sección 4). `MAX_ROUTE_POINTS = 500`, valor definitivo.**
5. **Orden manual de paradas detrás de una interfaz enchufable, sin optimizador automático en esta ronda.** — **Aprobado: Opción A (sección 5), con corrección: sin ETA por Parada** — no se inventa una hora estimada de llegada sin datos reales para calcularla.
6. **Ventana horaria + días de visita en `ClientAccount`.** — **CAMBIO DE RECOMENDACIÓN: Opción C, no la Opción A original** (sección 6) — van como objeto anidado `preferenciasEntrega: { ventanaDesde, ventanaHasta, diasVisita } | null`, no como 3 campos planos sueltos, para no cementar el supuesto de dirección única en un tercer lugar mientras esté abierta la contradicción sobre si multi-dirección es MVP o crecimiento.
7. **Documentos impresos vía job server-side.** — **Aprobado: Opción A (sección 7), con corrección: el documento tiene que ser reproducible** — el mismo job devuelve siempre el mismo contenido, snapshoteado al momento de la emisión, nunca regenerado con datos de hoy. La decisión de si la generación de PDF necesita una dependencia nueva sigue pendiente para la tanda de implementación.
8. **Pregunta que contradice/roza un ADR ya aprobado — RESUELTA con una enmienda, no queda abierta:** ADR-003 fijaba el polling en 30s parejo para todo lo que use `useLiveQuery`. **Se enmendó ADR-003** (ver la sección de enmienda fechada en `ADR-003-tiempo-real.md`): `useLiveQuery` ahora acepta un intervalo configurable por consumidor, default 30s sin cambios para los consumidores existentes, y la posición del Viaje usa 10-15s — sin crear un mecanismo de polling paralelo por fuera de `useLiveQuery`.
