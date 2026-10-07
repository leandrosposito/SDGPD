# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

SDGPD is an ERP built around business domains (Core, Comercial, Inventario, Logística, Caja, Analítica).

## Structure

- `FrontEnd/` — React app, actively developed. All code today lives here. See `FrontEnd/CLAUDE.md` for stack, architecture, and implementation details.
- `BackEnd/` — backend NestJS + PostgreSQL (monorepo, ADR-BE-001). **Decidido y documentado, todavía sin código** (2026-10-07): solo tiene `BackEnd/CLAUDE.md` y `BackEnd/docs/` (11 ADRs + plan de tandas BE-0 a BE-10). Read `BackEnd/CLAUDE.md` before touching it.
- `Documentacion/` — business/domain specs (Product Vision, Arquitectura Funcional del Negocio, Modelo Funcional del Dominio) as .docx/.pdf, plus some derived .md/.txt extracts. See `Documentacion/README.md` first — it maps which file is which and which ones are current vs. archived. Consult these for business rules and domain vocabulary (in Spanish) before inventing behavior for a module.

## Commands

No repo-root-level commands. All commands run from `FrontEnd/` — see `FrontEnd/CLAUDE.md`.

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
