import type { UserAccount, PermissionMatrix, SystemRole } from '@/shared/types/settings.types';
import type { PageQuery, PageResult } from '@/shared/types/pagination.types';
import { SETTINGS_MOCK_USERS, SETTINGS_MOCK_PERMISSIONS } from '@/data/mock/settings.data';
import { httpClient } from '@/shared/api/httpClient';
import type { UserAccountDTO, UsersPageDTO, PermissionMatrixDTO } from './dto';
import { userFromDTO, userToDTO, permissionMatrixFromDTO, permissionMatrixToDTO } from './mapper';

// ============================================================
// users-roles.service — Único punto que habla con httpClient para
// Usuarios y la Matriz de Permisos (Tanda 3c de escalabilidad). Todo
// lo que sale de acá ya está en forma de dominio — los DTO nunca
// cruzan este archivo hacia afuera.
//
// Sin branchId (confirmado contra el código, no asumido): usuarios y
// permisos son de la empresa, no de una sucursal — cero referencias a
// sucursal en todo el módulo settings.
//
// Sin alta/edición de usuario: "Nuevo Usuario"/"Password"/"2FA"
// (TabUsersRoles.tsx) no tienen ningún `onClick` — son decorativos
// desde antes de esta tanda, no se les inventa una mutación acá.
// ============================================================

export interface UsersQueryFilters {
  empresaId: string;
}

// Un solo campo de orden: TabUsersRoles.tsx no tenía sort de columna
// (a diferencia de SuppliersTable) — se ordena por nombre, sin
// selector en la UI que la vista original tampoco tenía.
export type UsersSortField = 'name';

// const, no let: no hay ninguna mutación de usuarios (sin alta/edición
// real, ver comentario del encabezado) — a diferencia de
// permissionsDTOStore, que sí se reasigna.
const usersDTOStore: UserAccountDTO[] = SETTINGS_MOCK_USERS.map(userToDTO);

// Matriz de permisos: reasignada (nunca mutada in-place) en cada
// escritura. Reemplaza el patrón anterior de TabUsersRoles.tsx, que
// mutaba SETTINGS_MOCK_PERMISSIONS in-place vía una referencia
// compartida sin clonar (ver DECISIONES_TECNICAS.md) — acá la
// persistencia es real, no un efecto secundario accidental.
let permissionsDTOStore: PermissionMatrixDTO[] = SETTINGS_MOCK_PERMISSIONS.map(permissionMatrixToDTO);

function compareUsers(a: UserAccountDTO, b: UserAccountDTO): number {
  return a.nombre.localeCompare(b.nombre);
}

function resolveMockUsersPage(query: PageQuery<UsersQueryFilters, UsersSortField>): UsersPageDTO {
  const sorted = [...usersDTOStore].sort((a, b) => {
    const cmp = compareUsers(a, b);
    return query.sort?.direction === 'desc' ? -cmp : cmp;
  });

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const safePage = Math.min(Math.max(1, query.page), totalPages);
  const start = (safePage - 1) * query.pageSize;

  return {
    data: sorted.slice(start, start + query.pageSize),
    meta: { total, page: safePage, page_size: query.pageSize },
  };
}

export async function getUsersPage(
  query: PageQuery<UsersQueryFilters, UsersSortField>,
  signal?: AbortSignal
): Promise<PageResult<UserAccount>> {
  const pageDTO = await httpClient.request<UsersPageDTO>({
    method: 'GET',
    path: '/settings/users',
    params: { empresaId: query.filters.empresaId, page: query.page, pageSize: query.pageSize },
    signal,
    mock: () => resolveMockUsersPage(query),
  });

  return {
    items: pageDTO.data.map(userFromDTO),
    total: pageDTO.meta.total,
    page: pageDTO.meta.page,
    pageSize: pageDTO.meta.page_size,
  };
}

// Matriz completa (4 roles) — vía useCachedQuery en el componente, no
// usePagedQuery: no tiene sentido paginar 4 filas que siempre se
// muestran enteras.
export async function getPermissionsMatrix(empresaId: string, signal?: AbortSignal): Promise<PermissionMatrix[]> {
  const dtos = await httpClient.request<PermissionMatrixDTO[]>({
    method: 'GET',
    path: '/settings/permissions',
    params: { empresaId },
    signal,
    mock: () => permissionsDTOStore,
  });
  return dtos.map(permissionMatrixFromDTO);
}

// Toggle de un módulo puntual para un rol — reemplaza a
// TabUsersRoles.tsx#togglePermission (mutación in-place accidental
// sobre el mock compartido). Devuelve la matriz completa actualizada
// para que el componente no tenga que recalcular nada localmente.
export async function updateRolePermission(
  empresaId: string,
  role: SystemRole,
  moduleKey: keyof PermissionMatrix['modules'],
  hasAccess: boolean
): Promise<PermissionMatrix[]> {
  const dtos = await httpClient.request<PermissionMatrixDTO[]>({
    method: 'PUT',
    path: `/settings/permissions/${role}`,
    body: { empresaId, modulo: moduleKey, acceso: hasAccess },
    mock: () => {
      permissionsDTOStore = permissionsDTOStore.map((dto) =>
        dto.rol === role ? { ...dto, modulos: { ...dto.modulos, [moduleKey]: hasAccess } } : dto
      );
      return permissionsDTOStore;
    },
  });
  return dtos.map(permissionMatrixFromDTO);
}
