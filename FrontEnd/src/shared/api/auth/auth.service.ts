import { loginResponseSchema, sessionSchema, type Session } from '@sdgpd/contracts';
import { httpClient } from '@/shared/api/httpClient';
import { ApiError } from '@/shared/api/ApiError';
import { setAccessToken } from '@/shared/auth/tokenStore';
import { asBranchId } from '@/shared/types/ids.types';
import type { SessionUser } from '@/shared/types/session.types';

// ============================================================
// auth.service — login, logout y sesion contra el backend (BE-1b,
// ADR-BE-003). Solo se usa cuando 'auth' va por http (serviceModes.ts);
// con auth en mock la sesion sale de services/mock/session.service.ts,
// como antes, y no hay login.
//
// Las respuestas se validan con los schemas de @sdgpd/contracts (el mismo
// contrato que valida el backend): una respuesta que no cumple es un error,
// no un objeto a medias. El access token queda SOLO en memoria (tokenStore);
// el refresh vive en la cookie HttpOnly que el navegador maneja solo.
// ============================================================

const AUTH_ONLY = (): never => {
  throw new ApiError(0, 'UNKNOWN', 'auth.service solo existe con auth por http (VITE_HTTP_SERVICES).');
};

/** Sesion del contrato → SessionUser del frontend. Las sucursales son solo las habilitadas. */
export function sessionUserFromContract(session: Session): SessionUser {
  const branches = session.branches.map((b) => ({ ...b, id: asBranchId(b.id) }));
  return {
    id: session.user.id,
    fullName: session.user.fullName,
    email: session.user.email,
    company: { id: session.company.id, name: session.company.name },
    role: session.role,
    permissions: session.permissions,
    branches,
    defaultBranchId: branches.find((b) => b.status === 'active')?.id ?? null,
  };
}

/** POST /api/auth/login (rama web: el refresh vuelve en la cookie). */
export async function login(email: string, password: string): Promise<SessionUser> {
  const body = await httpClient.request<unknown>({
    method: 'POST',
    path: 'auth/login',
    service: 'auth',
    auth: 'none',
    withCredentials: true,
    body: { email, password, clientType: 'web' },
    retries: 0,
    mock: AUTH_ONLY,
  });
  const response = loginResponseSchema.parse(body);
  setAccessToken(response.accessToken);
  return sessionUserFromContract(response.session);
}

/** GET /api/auth/session, con el access token vigente. */
export async function fetchCurrentSession(signal?: AbortSignal): Promise<SessionUser> {
  const body = await httpClient.request<unknown>({
    method: 'GET',
    path: 'auth/session',
    service: 'session',
    signal,
    mock: AUTH_ONLY,
  });
  return sessionUserFromContract(sessionSchema.parse(body));
}

/** POST /api/auth/logout: revoca la familia del refresh (por el access token) y borra la cookie. */
export async function logout(): Promise<void> {
  try {
    await httpClient.request<void>({
      method: 'POST',
      path: 'auth/logout',
      service: 'auth',
      withCredentials: true,
      retries: 0,
      mock: AUTH_ONLY,
    });
  } finally {
    setAccessToken(null);
  }
}
