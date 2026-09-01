// ============================================================
// SHARED TYPE DEFINITIONS — Session domain (empresa/sucursal)
// La empresa es solo dato descriptivo de sesion (ver DECISIONES_TECNICAS.md,
// D1): el frontend nunca la usa como filtro ni la envia como parametro
// manipulable. La sucursal si es estado de UI de primera clase (D2).
// ============================================================

export interface Branch {
  id: string;
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
