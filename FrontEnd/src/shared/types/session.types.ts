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

export interface SessionUser {
  id: string;
  fullName: string;
  email: string;
  company: Company;
  branches: Branch[];
  defaultBranchId: Branch['id'];
}
