# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

SDGPD is an ERP built around business domains (Core, Comercial, Inventario, Logística, Caja, Analítica).

## Structure

- `FrontEnd/` — React app, actively developed (todavía sobre adaptadores mock). See `FrontEnd/CLAUDE.md` for stack, architecture, and implementation details.
- `BackEnd/` — backend NestJS + PostgreSQL (monorepo, ADR-BE-001). **BE-0a hecha (2026-10-08):** esqueleto, Postgres en Supabase con RLS y suites de aislamiento, sin endpoints de negocio. Read `BackEnd/CLAUDE.md` before touching it.
- `packages/contracts/` — contrato HTTP compartido (Zod), consumido por `BackEnd` (y por `FrontEnd` cuando se sume a los workspaces).
- `Documentacion/` — business/domain specs (Product Vision, Arquitectura Funcional del Negocio, Modelo Funcional del Dominio) as .docx/.pdf, plus some derived .md/.txt extracts. See `Documentacion/README.md` first — it maps which file is which and which ones are current vs. archived. Consult these for business rules and domain vocabulary (in Spanish) before inventing behavior for a module.

## Commands

- **Frontend:** todo corre desde `FrontEnd/`, incluido su `npm ci` (`FrontEnd` todavía no es un workspace). Ver `FrontEnd/CLAUDE.md`.
- **Backend y `packages/contracts`:** desde la raíz (workspaces `BackEnd` y `packages/*`, lockfile en la raíz):
  - `npm ci`
  - `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`: todos los workspaces; con `-w @sdgpd/backend` o `-w @sdgpd/contracts`, uno solo.
  - `npm run start -w @sdgpd/backend`: levanta el backend (`GET /health`).
  - `npm run db:setup -w @sdgpd/backend`, `npm run db:migrate -w @sdgpd/backend`, `npm run db:generate -w @sdgpd/backend`, `npm run db:sql -w @sdgpd/backend -- <rol> "<sql>"`: base de datos (ver `BackEnd/docs/SETUP_SUPABASE.md`).

## Dónde buscar

| Vas a... | Mirá primero |
|---|---|
| Tocar la estructura de `src/` (módulos, capas, dónde vive qué) | `FrontEnd/docs/ARQUITECTURA.md` |
| Entender una decisión técnica ya tomada | `FrontEnd/docs/DECISIONES_TECNICAS.md` + `FrontEnd/docs/adr/` |
| Saber el estado actual del proyecto (qué está cerrado, qué sigue abierto) | `FrontEnd/docs/ESTADO.md` |
| Ver la deuda técnica viva | `FrontEnd/docs/PENDIENTES.md` |
| Migrar un listado a la capa `api/` + `usePagedQuery` | `FrontEnd/docs/GUIA_MIGRACION_MODULO.md` |
| El proceso de trabajo en sí (fases, gates, cuándo mergear) | `FrontEnd/docs/PROTOCOLO.md` |
| Empezar o continuar el backend (ADRs, trazabilidad, plan de tandas BE-0 a BE-10) | `BackEnd/docs/README.md` |
| Una decisión de backend ya tomada (tenancy, contrato HTTP, dinero, stock…) | `BackEnd/docs/adr/ADR-BE-*.md` |
| La evidencia de por qué se decidió algo del backend | `FrontEnd/docs/historial/auditorias/backend/00_RESUMEN.md` |
