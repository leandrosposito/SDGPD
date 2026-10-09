import type { Action, Module, Permission } from '@sdgpd/contracts';

// ============================================================
// permissions — la regla pura detras de usePermission (BE-1b): ¿la lista de
// permisos de la sesion incluye modulo.accion? Sin dependencias de React ni
// del store, para poder ejercitarla con `node` (scripts/smoke/be-1b-ui.smoke.mjs).
// ============================================================

export function hasPermission(permissions: readonly Permission[] | undefined, module: Module, action: Action): boolean {
  return permissions?.some((p) => p.module === module && p.action === action) ?? false;
}
