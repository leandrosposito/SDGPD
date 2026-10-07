# ADR-BE-001 — Stack, repositorio y forma de trabajo

**Estado:** Aceptado. **Fecha:** 2026-10-07. **Resuelve:** decisión #26 de [`08_DECISIONES_ABIERTAS.md`](../../../FrontEnd/docs/historial/auditorias/backend/08_DECISIONES_ABIERTAS.md).

**Enmienda a ADRs del frontend:** ninguno (cambia la regla 2.3 del protocolo y el `.gitignore`).

## Contexto

La auditoría de backend (`FrontEnd/docs/historial/auditorias/backend/`, 2026-10-07) encontró que `BackEnd/` existía vacío y estaba en `.gitignore`. La regla `BackEnd/` no tenía barra inicial y, con `core.ignorecase=true`, ignoraba cualquier carpeta `backend/` del repo, incluida la de la propia auditoría (hallazgo **A18**, `00_RESUMEN.md`). El frontend ya tiene contratos tipados y una capa `api/` sobre `httpClient` con adaptador mock (`FrontEnd/src/shared/api/httpClient.ts:5-12`). Lo que no existe es un lugar compartido donde backend y frontend acuerden el contrato: 59 de 91 respuestas devuelven hoy el tipo de dominio del frontend (hallazgo **B4**).

La regla `BackEnd/` se sacó del `.gitignore` en el commit `509963b` de esta misma sesión (Paso 0).

## Decisión

1. **Monorepo.** El backend vive en `BackEnd/` de este repositorio, con las mismas reglas de rama, tags y merge que el frontend (`FrontEnd/docs/PROTOCOLO.md` §2.1 y §8).
2. **Stack:** Node LTS + TypeScript estricto + NestJS + PostgreSQL. **PostgreSQL es la única infraestructura obligatoria**: nada de Redis, colas externas ni otros servicios hasta que una medición lo pida. Lo que suele resolverse con esas piezas (jobs, colas, locks, caché) se resuelve con Postgres (tablas de trabajo con `FOR UPDATE SKIP LOCKED`, advisory locks).
3. **Acceso a datos: Drizzle ORM**, con migraciones SQL versionadas en el repo. **Nunca** sincronización automática de esquema (`drizzle-kit push` prohibido).
4. **Contrato compartido:** paquete `packages/contracts`, con schemas Zod y los tipos inferidos de ellos, consumido por `BackEnd` y `FrontEnd` vía **npm workspaces**. Un cambio de contrato que rompe al otro lado tiene que fallar en `tsc`.
5. **Testing:** permitido y obligatorio en `BackEnd/`. La regla 2.3 del protocolo queda acotada a `FrontEnd/`. Hay tests de integración contra **PostgreSQL real** y una **suite de aislamiento entre empresas que cubre todas las tablas**.
6. **Gates de una tanda de backend** (equivalentes a los 8 de `PROTOCOLO.md` §5):

| # | Gate | Criterio |
|---|---|---|
| 1 | Tipos | `tsc --noEmit` sin errores en `BackEnd/` y `packages/contracts/`, y en `FrontEnd/` si la tanda tocó `contracts` |
| 2 | Lint | `eslint` sin errores nuevos |
| 3 | Build | build de producción de `BackEnd/` exitoso |
| 4 | Tests | unitarios + integración contra Postgres real en verde, **incluida la suite de aislamiento** (ADR-BE-002), que tiene que cubrir toda tabla con `empresa_id` (el test enumera las tablas desde el catálogo de Postgres; una tabla nueva sin caso de aislamiento lo hace fallar) |
| 5 | Conexión | todo endpoint nuevo tiene su schema en `packages/contracts` y al menos un consumidor real: el adaptador `http` del frontend en la misma tanda, o una tanda de frontend nombrada en el checklist que lo conecta |
| 6 | Autorrevisión | sin `any`/`@ts-ignore`; ningún DTO de request con `empresaId` (ADR-BE-002); toda tabla con `empresa_id NOT NULL` y RLS forzado; migraciones SQL leídas línea por línea; sin `drizzle-kit push` |
| 7 | Checklist | `BackEnd/docs/verificaciones/VERIFICACION_BE-<n>.md` con los requests concretos (método, path, body) y su resultado esperado. Si la tanda conecta un módulo del frontend, también los pasos de navegador |
| 8 | Arquitectura | si la tanda cambió la estructura de `BackEnd/src`, `BackEnd/docs/ARQUITECTURA.md` se actualiza en la misma tanda |

## Alternativas descartadas (08 #26)

- **Repositorio separado:** duplica rama, tags y protocolo, y saca el contrato del mismo `tsc` que lo valida. El punto 4 (un cambio de contrato que rompe al otro lado falla en `tsc`) solo es posible con los dos lados en el mismo workspace.
- **Mantener `BackEnd/` ignorado:** es exactamente el hallazgo A18. El trabajo no se versionaría y no daría ningún aviso.

## Consecuencias para el backend

- La raíz del repo pasa a tener un `package.json` de workspaces (`FrontEnd`, `BackEnd`, `packages/*`) y un único lockfile. Se crea en BE-0, no en esta sesión.
- `packages/contracts` es la fuente única de los DTO, las listas blancas de filtros y orden (ADR-BE-004), las columnas exportables (ADR-BE-011) y la función de cálculo de importes (ADR-BE-006).
- Toda migración es un archivo SQL en el repo, generado (`drizzle-kit generate`) o escrito a mano, y revisado. Una migración destructiva (borrar o renombrar columna con datos) necesita un ADR.

## Consecuencias para el frontend

- `FrontEnd/` pasa a ser un workspace. Los comandos siguen corriendo desde `FrontEnd/`, pero la instalación (`npm ci`) se hace desde la raíz.
- Al conectar cada módulo, sus DTO y mappers locales (`modules/*/api/dto.ts`) se reemplazan por los de `packages/contracts`.
- La regla 2.3 deja de prohibir tests en el repo: sigue vigente **solo para `FrontEnd/`**.

## Hallazgos que cierra

- **A18** (`.gitignore` ignoraba `BackEnd/` y toda carpeta `backend/`): cerrado por el Paso 0 de esta sesión (`509963b`) y por este ADR.

## Sub-decisiones tomadas al redactar (pendientes de revisión)

1. **Node 22 LTS** como versión concreta de "Node LTS".
2. **Herramienta de test: Vitest** (no Jest, el default de NestJS): un solo runner ESM/TypeScript para `BackEnd` y `packages/contracts`.
3. **Postgres de test:** se obtiene de `DATABASE_URL_TEST`. Quién lo provee (instalación local, contenedor) no se fija, para no agregar Docker como infraestructura obligatoria. Cada test corre en una transacción que se revierte, o en un schema descartable.
4. **Validación en NestJS:** un `ZodValidationPipe` propio que usa los schemas de `contracts`, en vez de `class-validator` (que duplicaría cada DTO) o de una librería de integración.
5. **Configuración:** variables de entorno validadas con un schema Zod al arrancar. Si falta una variable, el proceso no levanta. `.env.example` es la única plantilla versionada (Paso 0 del `.gitignore`).
6. **Gate 5 (conexión):** un endpoint sin consumidor del frontend en la misma tanda se acepta **solo** si el checklist nombra la tanda que lo conecta. Mismo espíritu que la "función huérfana" (trampa 6.3).
7. **Ubicación de los checklists y de `ARQUITECTURA.md` del backend:** `BackEnd/docs/verificaciones/` y `BackEnd/docs/ARQUITECTURA.md`. Se crean en la primera tanda con código.

## Objeciones

1. **La regla 2.2 del protocolo prohíbe instalar dependencias** (`FrontEnd/docs/PROTOCOLO.md:24`: "Prohibido instalar dependencias. Si algo parece requerirla, resolverlo sin ella o dejarlo documentado como no hecho"). Construir este stack requiere instalar NestJS, Drizzle, Zod, el driver de Postgres y Vitest. La sesión solo autoriza reescribir §1, 2.3, 3.1 y 3.5, así que **la 2.2 queda vigente y bloquea BE-0** hasta que se la acote (por ejemplo, "en `FrontEnd/`") o se defina un mecanismo de aprobación de dependencias.
2. **npm workspaces mueve el lockfile a la raíz.** Hoy `FrontEnd/package-lock.json` es el lockfile, y la verificación D8 exige "Confirmar con `git diff` que `package.json` y el lockfile no cambiaron" (`PROTOCOLO.md:77`). La primera tanda que cree el workspace cambia ambos por diseño, así que D8 necesita una excepción explícita para esa tanda.
3. `FrontEnd/CLAUDE.md` dice que todos los comandos corren desde `FrontEnd/` y que el package manager es npm con `package-lock.json` en esa carpeta. Con workspaces, eso deja de ser cierto. Ese archivo está fuera del alcance de esta sesión y queda desactualizado hasta BE-0.
