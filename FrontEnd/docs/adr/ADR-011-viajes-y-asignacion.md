# ADR-011 — Viajes, capacidad y motor de asignación

**Estado:** Propuesto (pendiente de las decisiones marcadas al final). **Fecha:** 2026-09-09. Depende de ADR-010 (asume que existen `Viaje`/`Parada` tal como los define ese ADR) — si Leandro no aprueba ADR-010 tal cual, este ADR necesita revisarse junto con él.

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

**Por qué el techo es MÁS chico que `MAX_EXPORT_ROWS`, no el mismo valor:** exportar es una operación de lectura (arma un archivo); asignar es una escritura real por fila (valida capacidad, marca el pedido, genera Parada) — el costo por fila es mayor y el radio de un error es mayor (10.000 asignaciones mal hechas por un filtro too-amplio son 10.000 correcciones manuales). Valor sugerido: 500-1.000, a confirmar con Leandro según el volumen real de pedidos por viaje esperado.

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
- **A2. Warning override-able:** el servidor permite agregar igual si el request trae `{ forzar: true }`, pero el Viaje queda marcado `sobrecargado: true` (visible en el listado de viajes) y el override queda registrado como evento de auditoría (quién, cuándo, por cuánto se excedió). Da flexibilidad operativa real (un vehículo a veces sí puede llevar un poco más de lo nominal) sin perder trazabilidad de que fue una decisión humana consciente.
- **A3. Split automático del viaje:** el sistema arma un segundo viaje solo para el excedente. **Descartada de entrada** (no una sub-opción real): partir automáticamente implica decidir vehículo/chofer para el viaje nuevo, una decisión de negocio que el sistema no puede tomar solo.

**Recomendación: A2 (warning override-able)** — es el balance entre no bloquear operación real (los números "nominales" de un vehículo casi siempre tienen margen real) y no perder el registro de que alguien decidió exceder el límite a propósito.

### Opción B — Validación client-side, sumando sobre `viaje.paradas` ya cargado

Descartada explícitamente por el protocolo: es exactamente "agregado calculado en el cliente sobre una colección completa" (regla de escalabilidad #2) — con un viaje de cientos de paradas, sumar en el navegador cada vez que se agrega una más es trabajo repetido e innecesario que además puede desincronizarse de lo que el servidor considera válido.

**Recomendación: Opción A, con la sub-opción A2.**

---

## 3. Concurrencia

### Opción A — Control optimista con versión/ETag, `409` al asignar

Cada `Order`/`Parada` expone una versión (`etag` o `version: number`, incrementada en cada escritura). El request de asignación incluye la versión que el cliente tenía al momento de decidir asignar; si no coincide con la actual (alguien más lo asignó/modificó mientras tanto), el servidor devuelve `409 Conflict` sin aplicar nada. El cliente muestra: **"Este pedido ya fue asignado a otro viaje (o modificado) por otra persona — tu selección se actualizó, revisá antes de reintentar"**, saca esa fila de la selección pendiente, y **refetchea la lista** (no reintenta a ciegas con la versión vieja).

**Ventaja:** simple, sin locks, mismo patrón que HTTP ya estandariza (ETag/If-Match) — no hace falta inventar nada nuevo. **Costo:** cada entidad mutable de este dominio necesita un campo de versión que hoy no tiene ninguna (`Delivery`/`Order` actuales no versionan) — cambio de esquema, no solo de lógica.

### Opción B — Lock pesimista (el usuario "reserva" el pedido al abrir el panel de asignación)

Descartada: requiere una sesión de "edición en curso" con expiración, liberación al cerrar/desconectar, y UI para mostrar "Fulano lo tiene abierto ahora mismo" — mucha más complejidad que el problema real justifica para una operación que dura segundos, no minutos.

**Recomendación: Opción A.**

---

## 4. Tiempo real y GPS

### Opción A — Dos endpoints separados: última posición (para el mapa) y recorrido histórico (aparte, simplificado)

- **`GET /viajes/{id}/posicion`**: un solo punto `{ lat, lng, timestamp }`, consumido por `useLiveQuery` con el mismo polling de 30s de ADR-003 — payload mínimo, sin importar cuánto lleve recorrido el viaje.
- **`GET /viajes/{id}/recorrido`**: endpoint aparte, bajo demanda (no polling), que devuelve el recorrido histórico **ya simplificado server-side** (decimado — un punto cada N metros/segundos, no cada punto crudo del GPS) con un **techo explícito de puntos** (constante nombrada, ej. `MAX_ROUTE_POINTS = 500` — a definir el valor exacto con Leandro según qué tan larga es una ruta típica). Nunca se manda al navegador la traza cruda del GPS (que en un viaje de horas puede ser miles de puntos).

**Ventaja:** el mapa en vivo nunca paga el costo del historial completo, y el historial (cuando alguien lo pide) tiene un techo conocido. **Costo:** el servidor necesita un algoritmo de simplificación de ruta (aunque sea simple — un punto cada N segundos, sin necesidad de Douglas-Peucker real para la primera versión).

### Opción B — Un solo endpoint que devuelve todo el recorrido acumulado, el mapa se queda con el último punto

Descartada: el polling de 30s repetiría cada vez una lista creciente de puntos (peor cuanto más avanza el día) — exactamente el patrón que A3 (paginación) de la corrida completa ya identificó como riesgo.

**Recomendación: Opción A.**

---

## 5. Secuencia de paradas

### Opción A — Orden manual (drag/reorder), detrás de una interfaz que un optimizador externo pueda implementar después

`Parada.orden: number` (o posición en un array ordenado), editable a mano por el operador (arrastrar filas). La función que decide el orden se aísla detrás de una interfaz (`ordenarParadas(paradas): Parada[]`) cuya única implementación hoy es "devolver el array en el orden que el usuario ya fijó a mano" — un botón "Optimizar ruta" (deshabilitado o ausente en esta primera versión) es, a futuro, otra implementación de la misma interfaz que llama a un servicio externo y reordena. **Nunca se optimiza en el cliente** (ni siquiera un algoritmo simple de vecino más cercano) — si el botón se habilita antes de tener un servicio real, debe llamar a un endpoint propio, no calcular en el navegador.

**Ventaja:** no bloquea la operación real esperando un optimizador que no existe todavía, y no cierra la puerta a enchufarlo después sin tocar componentes (la UI de reordenar a mano sigue funcionando igual, el botón nuevo es aditivo). **Costo:** ninguno adicional — es el camino más simple que además dejo bien encaminado.

### Opción B — Optimización automática desde el día uno (algoritmo propio o servicio externo ya integrado)

Descartada por alcance: integrar un optimizador de rutas real (con restricciones de ventana horaria, tráfico, capacidad) es un proyecto en sí mismo, no una decisión de modelado — fuera de lo que este ADR puede/debe resolver. Se dimensiona cuando haya una decisión de negocio de qué servicio usar (costo, dependencia externa — prohibida sin autorización explícita, regla 2 del protocolo).

**Recomendación: Opción A.**

---

## 6. Ventanas horarias

### Problema de modelado adicional, no solo de decisión

`ClientAccount` (`client.types.ts:51-66`) tiene un único campo `address: string` — no existe hoy ninguna relación cliente↔sucursal ni múltiples direcciones por cliente (confirmado: no hay ningún campo de dirección secundaria ni tabla de relación en el tipo actual). Esto acota las opciones reales:

### Opción A — Ventana horaria + días de visita como campos nuevos en `ClientAccount`

`ventanaDesde`/`ventanaHasta` (hora) + `diasVisita: DiaSemana[]`, directo en el cliente — coherente con que hoy el cliente tiene una sola dirección (no hace falta resolver "ventana de qué dirección"). El motor de asignación (ADR-010/011) los lee como **restricción blanda** (warning si se intenta asignar una Parada fuera de la ventana o un día no habilitado), no un bloqueo duro — un distribuidor real a veces entrega fuera de ventana por acuerdo puntual con el cliente, bloquear duro sería más rígido de lo que el negocio necesita.

**Costo:** si en el futuro un cliente tiene múltiples direcciones/sucursales con ventanas distintas, estos campos hay que moverlos a esa relación nueva (que hoy no existe) — deuda aceptada explícitamente, no un error de esta decisión.

### Opción B — Esperar a que exista una relación cliente-sucursal antes de modelar ventanas horarias

Más "correcta" en abstracto, pero bloquea la capacidad completa (ninguna ventana horaria) hasta que se resuelva un modelado que ningún ADR pidió resolver todavía. **Descartada** por alcance — no es este ADR el lugar para decidir si `Client` necesita multi-dirección.

**Recomendación: Opción A**, documentando explícitamente el costo de migración futura si el modelo de cliente cambia.

---

## 7. Documentos impresos

### Opción A — Mismo patrón que exportación (ADR-004): job server-side + polling + descarga

Hoja de ruta y remitos se generan igual que cualquier export del proyecto (`ExportButton`, `exportJobs.ts`, `buildExportFile.ts` ya existentes) — un job asíncrono que arma el documento del lado del servidor (o del mock, simulando servidor), el cliente hace polling de su estado, y descarga el archivo terminado. **Nunca PDF armado en el navegador** (regla de escalabilidad #3, ya vigente para todo el resto del proyecto).

**Costo:** el generador de PDF (hoja de ruta con mapa/lista de paradas, remito con líneas y totales) es lógica nueva del lado del "servidor" (mock) — no existe hoy ningún generador de PDF en el proyecto (los exports actuales son Excel/CSV vía `xlsx`, no PDF). Puede requerir evaluar una librería de generación de PDF — **si la requiere, es una dependencia nueva, prohibida sin autorización explícita (regla 2 del protocolo)** — se deja como costo a confirmar en la tanda de implementación, no se resuelve acá.

### Opción B — Generación en el navegador (`window.print()` o una librería de PDF client-side)

Descartada explícitamente por el enunciado del problema y por la regla de escalabilidad #3 ya vigente — el mismo patrón que ya se prohibió para exports de listados se prohíbe acá por la misma razón (documento generado sin límite de tamaño controlado, trabajo repetido en cada dispositivo en vez de una vez server-side).

**Recomendación: Opción A**, con el costo de la librería de PDF marcado explícitamente como pendiente de decidir (puede resolverse sin dependencia nueva si el "PDF" del mock es en realidad HTML imprimible servido como blob — a evaluar en implementación, no acá).

---

## Decisiones que Leandro tiene que tomar

1. **¿Selección por filtro con techo duro (`MAX_ASSIGNMENT_ROWS`), además de lista explícita?** — **Recomendado: sí (Opción A, sección 1).** Falta fijar el valor del techo (sugerido: 500-1.000, a confirmar contra volumen real esperado).
2. **¿Capacidad validada 100% server-side, con warning override-able (no error duro, no split automático) cuando un pedido no entra?** — **Recomendado: sí, sub-opción A2 (sección 2).**
3. **¿Control optimista con versión/ETag y `409` en vez de lock pesimista?** — **Recomendado: sí (Opción A, sección 3).**
4. **¿Separar "última posición" (polling, liviano) de "recorrido histórico" (bajo demanda, simplificado con techo de puntos)?** — **Recomendado: sí (Opción A, sección 4).** Falta fijar `MAX_ROUTE_POINTS`.
5. **¿Orden manual de paradas detrás de una interfaz enchufable, sin optimizador automático en esta ronda?** — **Recomendado: sí (Opción A, sección 5).**
6. **¿Ventana horaria + días de visita como campos directos de `ClientAccount` hoy, aceptando el costo de migrar si `Client` gana multi-dirección después?** — **Recomendado: sí (Opción A, sección 6)** — es una decisión de modelado de OTRO dominio (`Client`) que este ADR toca de paso; si Leandro prefiere no tocar `client.types.ts` desde un ADR de logística, la alternativa es dejar esta capacidad fuera de esta ronda.
7. **¿Documentos impresos vía job server-side, dejando pendiente si la generación de PDF necesita una dependencia nueva?** — **Recomendado: sí (Opción A, sección 7)** — la decisión de la librería (si hace falta) queda para la tanda de implementación, no para este ADR.
8. **Pregunta que contradice/roza un ADR ya aprobado, no resuelta acá:** ADR-003 fija el polling en 30s parejo para todo lo que use `useLiveQuery` — la posición del Viaje (sección 4) probablemente necesite un intervalo DISTINTO (más frecuente, un vehículo se mueve más rápido de lo que cambia una lista de entregas) o un mecanismo de opt-in de intervalo por consumidor de `useLiveQuery`, que ADR-003 no contempla. **No lo resuelvo acá** porque tocaría un ADR ya aprobado — queda como pregunta abierta para decidir si ADR-003 se extiende o si la posición del Viaje necesita su propio mecanismo por fuera de `useLiveQuery`.
