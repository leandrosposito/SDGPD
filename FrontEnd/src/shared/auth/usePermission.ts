import type { Action, Module } from '@sdgpd/contracts';
import { useSessionStore } from '@/shared/state/useSessionStore';
import { hasPermission } from './permissions';

// ============================================================
// usePermission — el UNICO lugar donde la UI pregunta por un permiso
// (BE-1b, ADR-BE-003 § Decision 4): modulo + accion de la matriz, leido de
// la sesion (GET /api/auth/session, o la sesion mock: Admin con todo).
//
// SOLO OCULTA: la autorizacion la hace el servidor en cada endpoint (403
// forbidden). Ocultar un boton no protege nada; mostrarlo de mas solo
// termina en un 403 con su mensaje.
// ============================================================

/** ¿El usuario de la sesion tiene `module.action`? Sin sesion, false. */
export function usePermission(module: Module, action: Action): boolean {
  // El selector devuelve un booleano (estable por valor): no arma objetos
  // nuevos (regla de selectores de zustand, DECISIONES_TECNICAS.md).
  return useSessionStore((s) => hasPermission(s.session?.permissions, module, action));
}
