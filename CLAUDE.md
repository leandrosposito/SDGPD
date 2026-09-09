# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

SDGPD is an ERP built around business domains (Core, Comercial, Inventario, Logística, Caja, Analítica).

## Structure

- `FrontEnd/` — React app, actively developed. All code today lives here. See `FrontEnd/CLAUDE.md` for stack, architecture, and implementation details.
- `BackEnd/` — completely empty, not started. No backend exists yet.
- `Documentacion/` — business/domain specs (Product Vision, Arquitectura Funcional del Negocio, Modelo Funcional del Dominio) as .docx/.pdf, plus some derived .md/.txt extracts. Consult these for business rules and domain vocabulary (in Spanish) before inventing behavior for a module.

## Commands

No repo-root-level commands. All commands run from `FrontEnd/` — see `FrontEnd/CLAUDE.md`.

## Dónde buscar (FrontEnd/docs/)

| Vas a... | Mirá primero |
|---|---|
| Tocar la estructura de `src/` (módulos, capas, dónde vive qué) | `docs/ARQUITECTURA.md` |
| Entender una decisión técnica ya tomada | `docs/DECISIONES_TECNICAS.md` + `docs/adr/` |
| Saber el estado actual del proyecto (qué está cerrado, qué sigue abierto) | `docs/ESTADO.md` |
| Ver la deuda técnica viva | `docs/PENDIENTES.md` |
| Migrar un listado a la capa `api/` + `usePagedQuery` | `docs/GUIA_MIGRACION_MODULO.md` |
| El proceso de trabajo en sí (fases, gates, cuándo mergear) | `FrontEnd/docs/PROTOCOLO.md` |
