// ============================================================
// SHARED TYPE DEFINITIONS — Session domain (empresa/sucursal)
// La empresa es solo dato descriptivo de sesion (ver DECISIONES_TECNICAS.md,
// D1): el frontend nunca la usa como filtro ni la envia como parametro
// manipulable. La sucursal si es estado de UI de primera clase (D2).
//
// Branch.id es BranchId (branded type, ADR-006/Tanda 5) — todo el
// resto del proyecto que hoy escribe `Branch['id']` para tipar un
// parametro/campo de sucursal (grep confirma ~25 sitios) recibe el
// branding automaticamente via indexed access, sin tocar esos archivos.
// ============================================================

import type { Permission } from '@sdgpd/contracts';
import type { BranchId } from './ids.types';

export interface Branch {
  id: BranchId;
  name: string;
  code: string;
  city: string;
  address: string;
  status: 'active' | 'inactive';
}

export interface Company {
  id: string;
  name: string;
}

// BE-1b (ADR-BE-003 § Decision 3): la sesion trae rol, permisos efectivos
// (matriz modulo × accion) y las sucursales HABILITADAS del usuario — con
// auth por http, `branches` son solo esas, asi que el selector de sucursal
// ofrece solo esas. La UI usa los permisos solo para ocultar (usePermission);
// la autorizacion la hace el servidor.
export interface SessionRole {
  id: string;
  name: string;
}

export interface SessionUser {
  id: string;
  fullName: string;
  email: string;
  company: Company;
  role: SessionRole;
  permissions: readonly Permission[];
  branches: Branch[];
  // null: el usuario no tiene ninguna sucursal activa habilitada.
  defaultBranchId: Branch['id'] | null;
}
