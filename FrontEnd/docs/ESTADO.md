# Estado — SDGPD

**Verificado:** 2026-10-10 contra el filesystem y `lean=e719e96c870244bc67756f3fa91f929315ef761c`. Este snapshot reemplaza el estado histórico anterior; las líneas de las auditorías de 2026-10-07 son evidencia histórica y se reverificaron antes de escribir el plan.

## Tandas cerradas

- Frontend: Tandas 0–25, ADR-009 y las correcciones documentadas en `FrontEnd/docs/historial/reportes/`.
- Backend: BE-0a, BE-0b, BE-1a, BE-1b y BE-1c están mergeadas en `lean`. Incluyen monorepo con `FrontEnd` como workspace, `packages/contracts`, RLS/aislamiento, idempotencia, `version`, auditoría, contadores, paginación, autenticación JWT/refresh, permisos, sucursales, HMAC, último-admin, prefijo `/api`, refresh entre pestañas y una sola zod.
- Por HTTP están conectados únicamente `auth`, `session`, `users`, `roles` y `branches`, configurados por `VITE_HTTP_SERVICES`. Los módulos de negocio restantes siguen en mock.

## Backend en curso

BE-2 (proveedores, motivos, vehículos y choferes) está en `origin/sesion-be2-2026-10-10`, commit WIP `b1aedf5`, sin mergear. Esa rama contiene auditoría de referencias, contratos, tablas, RLS, endpoints, seed y aislamiento de los cuatro maestros. Faltan tests de endpoints y contratos, typecheck/lint/build/gates, checklist y reporte, documentación de cierre y conexión del frontend. No se presenta BE-2 como hecha.

Al retomar BE-2, primero hay que mergear `lean` dentro de su rama porque esta sesión cambia `ESTADO.md`, `BackEnd/docs/README.md`, los `CLAUDE.md` y el plan; habrá conflictos chicos de texto.

## Plan pendiente

Las consignas ejecutables están en `BackEnd/docs/plan/README.md`:

| Tanda | Estado | Bloqueo |
|---|---|---|
| BE-02 | En curso en rama sin mergear | cierre de la rama |
| BE-03 | Lista para implementar después de BE-2 | — |
| BE-04 | Lista después de BE-3 | — |
| BE-05 | Bloqueada por BE-3/BE-4 | productos, clientes, precios y stock |
| BE-06 | Bloqueada por BE-5/BE-4; RF-PRE aparte | entregas/remitos |
| BE-07 | Bloqueada por BE-6 y D-09 | storage y operación |
| BE-08 | Bloqueada por BE-2/3/4 y D-06 | recepción parcial |
| BE-09 | Bloqueada por D-01 | Facturación |
| BE-10 | Bloqueada parcialmente por D-09 | jobs, storage y observabilidad |

Facturación, alta de empresas productivas, precio por producto en una lista y entidades Preparación/Despacho no se inventan dentro de las tandas: están en `BackEnd/docs/plan/DECISIONES_PENDIENTES.md` y `FUERA_DE_PLAN.md`.

## Deuda viva

- Checklists BE-0a, BE-0b, BE-1a, BE-1b y BE-1c siguen sin ejecución funcional/manual confirmada.
- Revisar SQL generado para retirar el prefijo `public.` antes de migrar; `drizzle-kit push` sigue prohibido.
- Hardening pendiente: `X-Powered-By`, validación IANA completa y riesgos operativos de setup.
- El chunk de entrada del frontend sigue elevado por contracts/auth; no es una deuda de dominio backend.
- `analytics` todavía no tiene service HTTP; dinero fuera del dashboard sigue siendo float en mocks; el tax rounding y formularios no migrados siguen abiertos hasta conectar sus tandas.
- `FrontEnd/docs/PENDIENTES.md` conserva deuda de dirección de entrega, catálogo server-side anidado, referencias huérfanas, Money sin consumidores de producción y respuestas de logística sin DTO; el plan asigna cada ítem vigente con disparador backend.
- Todos los checklists de navegador históricos se consideran pendientes hasta que exista evidencia de ejecución.

## Fuente de verdad y verificación

- ADRs backend y sus objeciones: `BackEnd/docs/adr/ADR-BE-001..011`.
- Auditoría base: `FrontEnd/docs/historial/auditorias/backend/00_RESUMEN.md` a `08_DECISIONES_ABIERTAS.md`.
- Plan ejecutable: `BackEnd/docs/plan/README.md`, specs BE-02..BE-10, `TRAZABILIDAD.md`, `DECISIONES_PENDIENTES.md`, `FUERA_DE_PLAN.md` y `DEUDA.md`.
- Verificador: `npm run docs:check -w @sdgpd/backend`; la salida completa de esta sesión queda en `FrontEnd/docs/historial/reportes/REPORTE_2026-10-10_plan-backend.md`.
