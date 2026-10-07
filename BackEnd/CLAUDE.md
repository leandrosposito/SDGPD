# CLAUDE.md (BackEnd)

Guía para Claude Code al trabajar en `BackEnd/`.

## Qué es esto

El backend de SDGPD: Node LTS + TypeScript + NestJS + PostgreSQL, multi-tenant con `empresa_id` y RLS, en el mismo monorepo que `FrontEnd/` (ADR-BE-001).

**Hoy `BackEnd/` tiene solo documentación** (2026-10-07): no hay código, `package.json`, migraciones ni `packages/`. Lo primero que se construye es la tanda BE-0.

## Qué leer antes de tocar algo

1. `BackEnd/docs/README.md`: los 11 ADRs, la trazabilidad de las 26 decisiones, los hallazgos y el plan de tandas BE-0 a BE-10.
2. Los ADRs `BackEnd/docs/adr/ADR-BE-0NN-*.md` que aplica la tanda (el plan dice cuáles). **Leé también sus secciones "Objeciones"**: hay choques sin resolver que bloquean partes del plan (por ejemplo, líneas en `Delivery` antes del despacho, y la regla 2.2 del protocolo antes de BE-0).
3. `FrontEnd/docs/PROTOCOLO.md`: el proceso de trabajo (fases, gates, merge) vale también para el backend. Los gates propios de una tanda de backend están en ADR-BE-001.
4. Para la evidencia de cualquier decisión: `FrontEnd/docs/historial/auditorias/backend/` (auditoría del 2026-10-07; empezá por `00_RESUMEN.md`).

## Invariantes (no se reabren sin un ADR nuevo)

- El tenant sale de la sesión: **ningún request lleva `empresaId`** (ADR-BE-002).
- Ids UUID v7 generados por el servidor (ADR-BE-004).
- Dinero en centavos enteros más moneda; no hay floats en el contrato (ADR-BE-006).
- Rechazos en 4xx con `{code, message, details?}` (ADR-BE-004).
- Un comando es una transacción, con sus efectos cruzados (ADR-BE-005).
- El actor sale de la sesión (ADR-BE-003).
- Postgres es la única infraestructura obligatoria (ADR-BE-001).
