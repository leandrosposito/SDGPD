# PROTOCOLO SDGPD — documento permanente de trabajo

Este archivo vive en el repo, en `FrontEnd/docs/PROTOCOLO.md`. No hay que volver a escribir prompts. Para arrancar cualquier sesión, alcanza con:

> Leé `FrontEnd/docs/PROTOCOLO.md` y aplicalo de punta a punta a estas tareas:
> - <tarea 1>
> - <tarea 2>

Todo lo demás (cómo auditar, cómo implementar, cómo verificar, cuándo mergear) está acá y no se discute en cada sesión.

## 1. CONTEXTO FIJO

- SDGPD: frontend de un SaaS ERP multi-empresa (cada empresa con sus clientes, sucursales y depósitos).
- Stack: React 19 + Vite + TypeScript + Zustand + TanStack Query + Zod + react-hook-form + Sonner + Lucide.
- No hay backend. Todo se apoya en contratos de API tipados + adaptadores mock. Cuando exista el backend real se cambia el adaptador, no la UI.
- Rama base de trabajo: `lean`. Nunca se toca `main`.
- Alcance de dominio: productos, proveedores, clientes, pedidos, caja y settings son alcance EMPRESA. Stock, reposición y logística son alcance SUCURSAL. Products es transversal (`shared/api/products/`).
- Antes de empezar cualquier tarea, leer: `docs/ESTADO.md`, los `docs/adr/ADR-*.md` y `docs/historial/verificaciones/VERIFICACION_CORRIDA_COMPLETA.md`. Los hallazgos y decisiones que ya están ahí no se re-discuten ni se re-auditan.
- `docs/historial/` no se lee al arrancar; solo se consulta si una tarea puntual lo pide (por ejemplo, para citar la evidencia original de un hallazgo ya resuelto). `docs/ESTADO.md` ya dice qué de ahí sigue vigente.

## 2. REGLAS PERMANENTES

1. Prohibido `git stash --keep-index` (Windows + OneDrive rompe el repo). Prohibido rebase, force push y tocar `main`.
2. Prohibido instalar dependencias. Si algo parece requerirla, resolverlo sin ella o dejarlo documentado como no hecho.
3. Prohibido agregar frameworks de testing. Prohibido i18n.
4. TypeScript estricto: nada de `any`, `@ts-ignore`, ni `as` para tapar un error de tipos.
5. Nunca se modifica un script de verificación para que deje de fallar. Si un check falla, se arregla el código o el dato, o se reporta el hallazgo. Si hay que cambiar un script porque el check estaba mal planteado, el cambio se justifica por escrito y la salida original que fallaba queda visible en el informe.
6. Si se delega en un fork, hay que verificar en disco que el trabajo existe (`git status`, `git show`, leer el archivo) antes de darlo por hecho. En este proyecto ya pasó dos veces que un fork reportó éxito sin haber escrito nada. La verificación adversarial (Fase D) nunca se delega.
7. Un commit por tanda, chico y reversible. Nada de un commit gigante al final.
8. La verificación funcional en navegador la hace Leandro. Cada tanda deja su checklist.
9. Cuando una tarea exija una decisión de diseño que ningún ADR cubre: tomarla, eligiendo la opción más consistente con los ADRs existentes, escribir el ADR nuevo, implementar, y marcarla bien visible en el informe final bajo "decisiones tomadas sin consultar". No frenar la corrida esperando respuesta.
10. Todo documento que afirme algo sobre la estructura del código (qué carpetas/archivos existen, cuántos hay, dónde vive qué) lleva al principio la fecha en que esa afirmación se verificó contra el filesystem. Quien lo lea después de esa fecha lo reverifica antes de confiar en él — la fecha no es decoración, es la advertencia de que el código pudo moverse desde entonces.

## 3. REGLAS DE ESCALABILIDAD (no negociables, aplican a todo código nuevo)

1. Ningún listado se consume sin paginar. Cursor por defecto.
2. Ningún agregado se calcula en el cliente sobre una colección completa. Totales, sumas, conteos y rankings vienen del servidor.
3. Ninguna exportación se arma en el navegador (salvo dentro del adaptador mock, y anotado como deuda a sacar cuando exista el backend).
4. Toda query key incluye `companyId`, y `branchId` si el dominio es de alcance sucursal.
5. Toda función de service lleva `empresaId` explícito, aunque no pase por el caché. La garantía de los hooks no cubre las llamadas directas.
6. Búsquedas con debounce y cancelación (`AbortController`).
7. Listas de más de ~100 filas visibles: preparadas para virtualización.
8. Filtros, página, orden y búsqueda viven en la URL, y la URL es la única fuente de verdad.
9. Nada de derivar datos del servidor con `useEffect` + `setState`.
10. Dinero: entero en centavos, por el módulo único de `shared/`. Nunca flotante, nunca aritmética suelta.
11. Todo request tiene un límite explícito.

## 4. PIPELINE (5 fases, siempre en este orden)

### Fase A — Auditoría de entrada (acotada a las tareas del día)

No re-auditar el proyecto entero. Sólo: qué tocan estas tareas, qué existe hoy en esos archivos, qué hallazgos previos del `AUDIT_00_RESUMEN` caen dentro del alcance, y qué se rompe si se cambia.

Sale en `docs/historial/auditorias/AUDIT_<fecha>_<tema>.md`: hallazgos con severidad y archivo:línea, qué está bien y no hay que romper, y el plan de tandas.

### Fase B — Decisiones

Para cada tarea: ¿hay un ADR que la cubra? Si sí, se sigue. Si no, se escribe uno nuevo según la regla 2.9 y se implementa. Los ADRs existentes son ley.

### Fase C — Implementación por tandas

Tandas chicas, ordenadas por dependencia, lo transversal primero (lo que cambia firmas o contexto compartido va antes que lo que lo consume). Cada tanda: implementar → 8 gates → checklist → commit → push.

### Fase D — Verificación adversarial (obligatoria, no se delega)

Postura: probar que lo que se hizo está mal. El que verifica es el que lo escribió, así que la suposición de partida es que hay errores y todavía no aparecieron. Cada verificación se aprueba con evidencia pegada (archivo:línea o salida de comando). "Lo revisé y está bien" no es un resultado válido.

Verificaciones mínimas, siempre:

- **D1 — Migraciones a medias.** Cuando una tanda cambia una representación o un patrón (dinero, IDs, estado en URL, contexto de sucursal), buscar si quedó una parte migrada. Dos representaciones conviviendo es peor que ninguna migración: compila perfecto y falla en producción. Rastrear el camino completo: mock → service → hook → componente → formateo.
- **D2 — Integridad referencial de los mocks.** Script `.mjs` que importe los mocks reales (no copias) y verifique que toda clave foránea resuelve. Pegar la salida.
- **D3 — El diff dice lo que el informe dice.** Recorrer el informe afirmación por afirmación contra `git show`. Marcar toda afirmación sin respaldo.
- **D4 — Reglas de escalabilidad sobre el diff nuevo.** Buscar violaciones de la sección 3, una por una.
- **D5 — Conformidad con los ADRs**, uno por uno, contra el código real.
- **D6 — Seguridad de tipos.** `any`, `as` sobre tipos de dominio, `@ts-ignore`, campos opcionales que deberían ser obligatorios: sólo dentro del diff de la sesión.
- **D7 — Restos.** Servicios sin consumidores, hooks reemplazados y no borrados, esquemas duplicados. Listar, no borrar.
- **D8 — Build desde cero.** `git status --porcelain` limpio, `rm -rf node_modules`, `npm ci`, `tsc --noEmit`, lint, build, todos los smoke. Confirmar con `git diff` que `package.json` y el lockfile no cambiaron. Pegar cada salida.

### Fase E — Merge

Según la sección 8.

## 5. LOS 8 GATES (al cierre de cada tanda)

1. `tsc --noEmit` sin errores nuevos respecto de la línea base.
2. `eslint` sin errores nuevos.
3. `vite build` exitoso.
4. Smoke script `.mjs` (sin framework) de la lógica pura agregada, en `scripts/smoke/`.
5. **Gate de conexión:** toda función nueva exportada tiene al menos un call-site real en la UI, sin contar su propio smoke test. Una función que sólo la llama su test es código muerto disfrazado de feature terminada, y hace que el gate 4 valide algo que nadie usa. Si no tiene call-site, la tanda no está terminada.
6. Autorrevisión del diff completo buscando: `any` colados, agregados en cliente, query keys sin scope, listados sin paginar, services sin `empresaId`, archivos fuera de alcance.
7. Checklist de navegador escrito en `docs/historial/verificaciones/VERIFICACION_<tanda>.md`, con pasos concretos y resultado esperado.
8. **Gate de arquitectura:** si la tanda cambió la estructura de `src/` (carpetas nuevas o borradas, módulos nuevos, un componente/service que se movió de lugar), actualizar `docs/ARQUITECTURA.md` es parte de la misma tanda, no una tarea de documentación aparte para después. Una tanda que cambia dónde vive algo y no toca `ARQUITECTURA.md` no está terminada.

Si un gate falla: corregir, máximo 3 intentos. Si sigue fallando, revertir esa tanda, documentarla como no hecha y seguir con la siguiente si es independiente.

## 6. TRAMPAS CONOCIDAS DE ESTE PROYECTO

Todas ya ocurrieron acá. Revisarlas activamente, no de memoria:

1. **El fork fantasma.** Un fork reporta éxito sin haber escrito nada. Ocurrió dos veces. Verificar en disco, siempre.
2. **La migración a medias.** Dinero en centavos en un módulo y en pesos flotantes en otro. Estado en la URL y un `useState` paralelo con el mismo valor. Compila, pasa gates, se desincroniza en silencio.
3. **La función huérfana.** Lógica correcta, con smoke test que pasa, que la UI nunca llama. Gate 5 existe por esto.
4. **El medidor ajustado.** Un check falla y se edita el script para que deje de fallar. Regla 2.5 existe por esto.
5. **El rodeo al linter.** `Promise.resolve().then(() => setState(...))` dentro de un efecto para que la regla de lint se calle. La regla se calla, el problema queda, con un tick de retraso encima. Si aparece la tentación, es señal de que el patrón está mal, no el linter.
6. **La garantía que no cubre todo.** `empresaId` es imposible de olvidar en los hooks de caché, pero los services llamados directo no tienen esa red. Regla 3.5 existe por esto.

## 7. DEFINICIÓN DE "TERMINADO"

Una tanda está terminada cuando: pasa los 8 gates, está conectada a la UI, tiene su checklist escrito, su commit propio y está pusheada. Las tres cosas juntas. Código que compila pero no lo llama nadie no está terminado.

## 8. MERGE — QUÉ SE SUBE Y QUÉ NO

Trabajar siempre en una rama derivada de `lean`, con `git tag pre-<sesión>` antes de empezar.

Al terminar la Fase D:

- Se mergean las tandas que pasaron, en orden, hasta la primera que falló. Si las tandas 1, 2 y 3 están bien y la 4 falló, se mergean 1 a 3 y ahí se corta. No se saltea una tanda para mergear la siguiente: dependen entre sí y cherry-pickear en el medio deja el árbol inconsistente.
- Los hallazgos CRÍTICO y ALTO se corrigen antes del merge, uno por commit, con la verificación que los detectó vuelta a correr después de cada fix.
- MEDIO y BAJO se documentan y no se tocan.
- Después de corregir, repetir la Fase D8 completa (build desde cero), porque arreglar un hallazgo puede romper otro.

Entonces:

```
git checkout lean
git merge --no-ff <rama-de-la-sesión>
git tag post-<sesión>
git push origin lean --tags
```

`--no-ff` es obligatorio: deja un único commit de merge revertible con `git revert -m 1 <hash>`.

Nunca mergear a `main`. Nunca mergear con un CRÍTICO o un ALTO abierto. Si no se puede mergear nada, se deja todo en la rama y se reporta.

## 9. CONDICIONES DE PARADA (detener la sesión y reportar)

1. Una query key o un service de datos de negocio sin `empresaId`.
2. Una tarea requiere una dependencia nueva.
3. Un gate falla 3 veces en una tanda de la que dependen las siguientes.
4. El build queda peor que la línea base y no se puede revertir limpio.
5. Implementar algo exigiría reescribir un dominio entero.

## 10. INFORME FINAL (siempre, en `docs/historial/reportes/REPORTE_<fecha>.md`)

```
## Qué hice, por tanda (hecha / parcial / no hecha + por qué)
## Commits creados (hash + mensaje) y qué se mergeó a lean
## Decisiones que tomé sin consultar   <- sección obligatoria, aunque esté vacía
## Hallazgos de la Fase D y cómo los corregí (con la evidencia antes y después)
## Hallazgos MEDIO/BAJO documentados y no tocados
## Riesgos introducidos
## Qué NO verifiqué (esta verificación es estática, no abre un navegador)
## Qué tiene que probar Leandro a mano, en orden de riesgo
## Cómo revertir el merge de un solo comando
```

La sección de qué no se verificó y qué queda para el navegador no es opcional y no se adorna. Los gates prueban que el código es coherente consigo mismo. No prueban que la aplicación funcione.

**Al cerrar la sesión también hay que reescribir `docs/ESTADO.md`** (tandas cerradas, hallazgos de `docs/historial/` que siguen abiertos, checklists sin ejecutar, deuda viva) — dejar solo el `REPORTE_<fecha>.md` no alcanza: ese documenta lo que se hizo esta sesión, `ESTADO.md` tiene que seguir siendo la foto de dónde está el proyecto ahora, y solo se mantiene así si cada sesión la actualiza.
