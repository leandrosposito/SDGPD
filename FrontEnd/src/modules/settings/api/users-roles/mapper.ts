import type { UserAccount, PermissionMatrix } from '@/shared/types/settings.types';
import type { UserAccountDTO, PermissionMatrixDTO } from './dto';

// ============================================================
// mapper.ts (settings/users-roles) — Único lugar que traduce
// DTO↔dominio para Usuarios y la Matriz de Permisos. Nada fuera de
// `users-roles.service.ts` lo importa.
// ============================================================

export function userFromDTO(dto: UserAccountDTO): UserAccount {
  return {
    id: dto.id,
    name: dto.nombre,
    email: dto.email,
    role: dto.rol,
    status: dto.estado,
  };
}

// Usada SOLO para sembrar el mock desde data/mock/settings.data.ts
// (dominio) — un backend real nunca la necesitaría.
export function userToDTO(user: UserAccount): UserAccountDTO {
  return {
    id: user.id,
    nombre: user.name,
    email: user.email,
    rol: user.role,
    estado: user.status,
  };
}

export function permissionMatrixFromDTO(dto: PermissionMatrixDTO): PermissionMatrix {
  return {
    role: dto.rol,
    modules: { ...dto.modulos },
  };
}

export function permissionMatrixToDTO(matrix: PermissionMatrix): PermissionMatrixDTO {
  return {
    rol: matrix.role,
    modulos: { ...matrix.modules },
  };
}
