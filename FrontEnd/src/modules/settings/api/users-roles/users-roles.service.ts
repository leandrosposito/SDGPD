import {
  branchPageSchema,
  rolePageSchema,
  roleSchema,
  userPageSchema,
  userSchema,
  type Branch,
  type CreateUserRequest,
  type Role,
  type UpdateRolePermissionsRequest,
  type UpdateUserRequest,
  type User,
} from '@sdgpd/contracts';
import type { PageQuery, PageResult, ExportResult } from '@/shared/types/pagination.types';
import { MAX_EXPORT_ROWS } from '@/shared/types/pagination.types';
import { SETTINGS_MOCK_ROLES, SETTINGS_MOCK_USERS } from '@/data/mock/settings.data';
import { SESSION_MOCK_DATA } from '@/data/mock/session.mock';
import { httpClient, isHttpService } from '@/shared/api/httpClient';
import { ApiError } from '@/shared/api/ApiError';

// ============================================================
// users-roles.service — Usuarios, roles (matriz modulo × accion) y
// sucursales de la empresa (BE-1b, ADR-BE-003). Unico punto que habla con
// httpClient para Settings › Usuarios y Roles.
//
// Contrato: el de @sdgpd/contracts (User, Role, Branch), el mismo que
// valida el backend — no hay dto.ts/mapper.ts propios: el wire ES el
// dominio, y las respuestas http se validan con sus schemas (un cuerpo que
// no cumple es un error, no un objeto a medias).
//
// Services: 'users' (GET/POST /api/users, PUT /api/users/:id), 'roles'
// (GET /api/roles, PUT /api/roles/:id/permissions) y 'branches'
// (GET /api/branches). Cada uno va por http si esta declarado en
// VITE_HTTP_SERVICES; si no, el mock en memoria de abajo, que imita las
// reglas del backend que la UI muestra: version (409 version-conflict),
// email unico (409 email-in-use) y ultimo admin (422 last-admin).
//
// Sin empresaId en ningun request (regla 3.5: el modulo esta conectado);
// el filtro empresaId queda solo para la query key (regla 3.4).
// ============================================================

export interface UsersQueryFilters {
  empresaId: string;
}

export type UsersSortField = 'fullName' | 'email' | 'createdAt';

// --- mock en memoria (solo si el service correspondiente no va por http) ---

let usersStore: User[] = structuredClone(SETTINGS_MOCK_USERS);
let rolesStore: Role[] = structuredClone(SETTINGS_MOCK_ROLES);

const LAST_ADMIN_MESSAGE = 'El cambio dejaria a la empresa sin ningun usuario activo que pueda editar usuarios y permisos';

function serverError(status: number, serverCode: string, message: string, details?: Record<string, unknown>): ApiError {
  return new ApiError(status, status >= 500 ? 'SERVER_ERROR' : 'CLIENT_ERROR', message, details ? { serverCode, details } : { serverCode });
}

function mockAdminRemains(users: User[], roles: Role[]): boolean {
  const editors = new Set(
    roles.filter((r) => r.permissions.some((p) => p.module === 'settings' && p.action === 'editar')).map((r) => r.id)
  );
  return users.some((u) => u.active && editors.has(u.roleId));
}

function compareUsers(a: User, b: User, field: UsersSortField): number {
  return a[field].localeCompare(b[field]);
}

function resolveMockUsersPage(query: PageQuery<UsersQueryFilters, UsersSortField>): PageResult<User> {
  const field = query.sort?.field ?? 'fullName';
  const sorted = [...usersStore].sort((a, b) => {
    const cmp = compareUsers(a, b, field);
    return query.sort?.direction === 'desc' ? -cmp : cmp;
  });
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(Math.max(1, query.page), totalPages);
  const start = (page - 1) * query.pageSize;
  return { items: structuredClone(sorted.slice(start, start + query.pageSize)), total, page, pageSize: query.pageSize };
}

// --- usuarios ---

export async function getUsersPage(
  query: PageQuery<UsersQueryFilters, UsersSortField>,
  signal?: AbortSignal
): Promise<PageResult<User>> {
  const page = await httpClient.request<PageResult<User>>({
    method: 'GET',
    path: 'users',
    service: 'users',
    params: {
      page: query.page,
      pageSize: query.pageSize,
      sortField: query.sort?.field,
      sortDirection: query.sort?.direction,
    },
    signal,
    mock: () => resolveMockUsersPage(query),
  });
  return isHttpService('users') ? userPageSchema.parse(page) : page;
}

/** Alta con contrasena inicial. La clave de idempotencia la genera el formulario al abrirse. */
export async function createUser(request: CreateUserRequest, idempotencyKey: string): Promise<User> {
  const user = await httpClient.request<User>({
    method: 'POST',
    path: 'users',
    service: 'users',
    body: request,
    idempotencyKey,
    mock: () => {
      const email = request.email.trim().toLowerCase();
      if (usersStore.some((u) => u.email === email)) throw serverError(409, 'email-in-use', 'Ese email ya lo usa otro usuario');
      const created: User = {
        id: `usr-${crypto.randomUUID()}`,
        email,
        fullName: request.fullName.trim(),
        roleId: request.roleId,
        active: request.active,
        branchIds: [...new Set(request.branchIds)],
        version: 1,
        createdAt: new Date().toISOString(),
      };
      usersStore = [...usersStore, created];
      return structuredClone(created);
    },
  });
  return isHttpService('users') ? userSchema.parse(user) : user;
}

/** Nombre, rol, activo y sucursales, con la version leida (409 si cambio; 422 last-admin). */
export async function updateUser(id: string, request: UpdateUserRequest, idempotencyKey: string): Promise<User> {
  const user = await httpClient.request<User>({
    method: 'PUT',
    path: `users/${id}`,
    service: 'users',
    body: request,
    idempotencyKey,
    mock: () => {
      const current = usersStore.find((u) => u.id === id);
      if (!current) throw serverError(404, 'not-found', 'user no existe');
      if (current.version !== request.version) {
        throw serverError(409, 'version-conflict', 'user cambio desde que se leyo', { currentVersion: current.version });
      }
      const next: User = {
        ...current,
        fullName: request.fullName.trim(),
        roleId: request.roleId,
        active: request.active,
        branchIds: [...new Set(request.branchIds)],
        version: current.version + 1,
      };
      const users = usersStore.map((u) => (u.id === id ? next : u));
      if (!mockAdminRemains(users, rolesStore)) throw serverError(422, 'last-admin', LAST_ADMIN_MESSAGE);
      usersStore = users;
      return structuredClone(next);
    },
  });
  return isHttpService('users') ? userSchema.parse(user) : user;
}

/**
 * Exportar (ADR-004): solo en mock. El backend todavia no exporta usuarios
 * (llega con los jobs de BE-10), asi que con 'users' por http la UI no ofrece
 * el boton. Nunca se arma una exportacion del backend en el navegador.
 */
export const usersExportAvailable = !isHttpService('users');

export async function exportUsers(): Promise<ExportResult<User>> {
  return httpClient.request<ExportResult<User>>({
    method: 'GET',
    path: 'users/export',
    mock: () => {
      const sorted = [...usersStore].sort((a, b) => compareUsers(a, b, 'fullName'));
      return { items: structuredClone(sorted.slice(0, MAX_EXPORT_ROWS)), truncated: sorted.length > MAX_EXPORT_ROWS };
    },
  });
}

// --- roles ---

/** Los roles de la empresa con su matriz (hasta 100, el pageSize maximo; una empresa tiene pocos). */
export async function getRoles(signal?: AbortSignal): Promise<Role[]> {
  if (!isHttpService('roles')) {
    return httpClient.request<Role[]>({ method: 'GET', path: 'roles', signal, mock: () => structuredClone(rolesStore) });
  }
  const page = await httpClient.request<unknown>({
    method: 'GET',
    path: 'roles',
    service: 'roles',
    params: { pageSize: 100 },
    signal,
    mock: () => [],
  });
  return rolePageSchema.parse(page).items;
}

/** Reemplaza la matriz del rol, con la version leida (409 si cambio; 422 last-admin). */
export async function updateRolePermissions(
  roleId: string,
  request: UpdateRolePermissionsRequest,
  idempotencyKey: string
): Promise<Role> {
  const role = await httpClient.request<Role>({
    method: 'PUT',
    path: `roles/${roleId}/permissions`,
    service: 'roles',
    body: request,
    idempotencyKey,
    mock: () => {
      const current = rolesStore.find((r) => r.id === roleId);
      if (!current) throw serverError(404, 'not-found', 'role no existe');
      if (current.version !== request.version) {
        throw serverError(409, 'version-conflict', 'role cambio desde que se leyo', { currentVersion: current.version });
      }
      const next: Role = { ...current, permissions: request.permissions, version: current.version + 1 };
      const roles = rolesStore.map((r) => (r.id === roleId ? next : r));
      if (!mockAdminRemains(usersStore, roles)) throw serverError(422, 'last-admin', LAST_ADMIN_MESSAGE);
      rolesStore = roles;
      return structuredClone(next);
    },
  });
  return isHttpService('roles') ? roleSchema.parse(role) : role;
}

// --- sucursales (para asignarlas a un usuario) ---

/** Con settings.ver, todas las sucursales de la empresa (GET /api/branches). */
export async function getBranches(signal?: AbortSignal): Promise<Branch[]> {
  if (!isHttpService('branches')) {
    return httpClient.request<Branch[]>({
      method: 'GET',
      path: 'branches',
      signal,
      mock: () => structuredClone(SESSION_MOCK_DATA.branches),
    });
  }
  const page = await httpClient.request<unknown>({
    method: 'GET',
    path: 'branches',
    service: 'branches',
    params: { pageSize: 100 },
    signal,
    mock: () => [],
  });
  return branchPageSchema.parse(page).items;
}
