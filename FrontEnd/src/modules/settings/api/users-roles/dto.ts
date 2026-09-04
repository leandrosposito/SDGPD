import type { SystemRole } from '@/shared/types/settings.types';

// ============================================================
// dto.ts (settings/users-roles) — Forma que tendría la respuesta de
// un backend real (Tanda 3c de escalabilidad). Deliberadamente
// distinta del dominio (`shared/types/settings.types.ts`): snake_case
// en los nombres de campo, mismo criterio que el resto de la capa
// api/ del proyecto. Los VALORES de los enums (`SystemRole`,
// `'active'|'inactive'`) se mantienen tal cual — solo cambian los
// nombres de campo, no los valores (mismo criterio que `estado` en
// `OrderDTO`/`tipo` en `CashTransactionDTO`).
//
// Dos entidades independientes en un mismo dto.ts porque comparten la
// misma vista ("Usuarios y Roles") y el mismo service — no porque
// compartan forma: `UserAccountDTO` y `PermissionMatrixDTO` no tienen
// ningún campo en común.
// ============================================================

export interface UserAccountDTO {
  id: string;
  nombre: string;
  email: string;
  rol: SystemRole;
  estado: 'active' | 'inactive';
}

export interface UsersPageDTO {
  data: UserAccountDTO[];
  meta: {
    total: number;
    page: number;
    page_size: number;
  };
}

// Matriz de permisos — no se pagina (4 roles, matriz completa visible
// siempre entera, ver DECISIONES_TECNICAS.md). Se consulta vía
// useCachedQuery, no usePagedQuery: por eso no tiene su propio
// "PageDTO", es una lista simple.
export interface PermissionMatrixDTO {
  rol: SystemRole;
  modulos: {
    dashboard: boolean;
    pedidos: boolean;
    inventario: boolean;
    clientes: boolean;
    proveedores: boolean;
    logistica: boolean;
    caja: boolean;
    analitica: boolean;
  };
}
