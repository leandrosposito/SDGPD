import { create } from 'zustand';
import type { Branch, SessionUser } from '@/shared/types/session.types';
import { fetchSession } from '@/services/mock/session.service';
import { httpClient, isHttpService } from '@/shared/api/httpClient';
import { ApiError } from '@/shared/api/ApiError';
import { queryClient } from '@/shared/api/queryClient';
import * as authService from '@/shared/api/auth/auth.service';
import { onSessionExpired } from '@/shared/auth/tokenStore';
import { resetAllStores } from './resettableStores';

// ============================================================
// useSessionStore — Sesion activa (empresa, usuario, sucursales)
// y sucursal activa elegida por el usuario.
//
// Store transversal, no de modulo: vive en shared/state/ (no en
// modules/<algo>/state/) porque la sesion y la sucursal activa no
// son de un dominio de negocio particular — las consume el layout
// (selector de sucursal) y cualquier modulo que necesite filtrar
// por sucursal (hoy, logistics). Es la primera excepcion a la
// convencion "todo store nuevo vive en su modulo" fijada en
// DECISIONES_TECNICAS.md, y la razon es exactamente la que esa
// misma convencion preveia como trigger de promocion a shared/.
//
// Contrato de acciones: igual que useDeliveriesStore/useReplenishmentStore,
// devuelven {success, reason?} en vez de lanzar excepciones o incluir
// texto de UI — quien llama (BranchSelector) decide el copy del toast.
//
// BE-1b: con 'auth' por http (VITE_HTTP_SERVICES), loadSession intenta un
// refresh (cookie HttpOnly): si funciona, pide GET /api/auth/session; si no,
// queda 'unauthenticated' y RequireSession manda al login. login/logout
// hablan con el backend. Si un refresh falla en medio de la sesion
// (tokenStore.onSessionExpired), la sesion se cierra y se vuelve al login.
// Con auth en mock, todo sigue como antes: sesion mock, sin login.
// ============================================================

/** ¿La sesion es real (backend) o mock? Un solo lugar: VITE_HTTP_SERVICES. */
export const AUTH_IS_HTTP = isHttpService('auth');

export type SessionStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated' | 'error';
export type LoginReason = 'invalid-credentials' | 'network' | 'unknown';

export interface LoginResult {
  success: boolean;
  reason?: LoginReason;
}

const ACTIVE_BRANCH_STORAGE_KEY = 'sdgpd.activeBranchId';

export type SessionLoadReason = 'fetch-error';
export type SetActiveBranchReason = 'not-found' | 'inactive';

export interface SessionLoadResult {
  success: boolean;
  reason?: SessionLoadReason;
}

export interface SetActiveBranchResult {
  success: boolean;
  branchId: Branch['id'];
  reason?: SetActiveBranchReason;
}

interface SessionState {
  session: SessionUser | null;
  activeBranchId: Branch['id'] | null;
  status: SessionStatus;
  isLoading: boolean;
  error: string | null;
  loadSession: () => Promise<SessionLoadResult>;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  setActiveBranch: (branchId: Branch['id']) => SetActiveBranchResult;
}

// La sucursal guardada es solo una conveniencia de UX (recordar la
// ultima eleccion entre recargas), no una autorizacion: el backend
// real debera validar igual que la sucursal pedida pertenezca a la
// empresa de la sesion autenticada antes de servir cualquier dato.
function resolveInitialBranchId(session: SessionUser): Branch['id'] | null {
  const storedBranchId = localStorage.getItem(ACTIVE_BRANCH_STORAGE_KEY);
  const storedBranch = session.branches.find(
    (branch) => branch.id === storedBranchId && branch.status === 'active'
  );

  // storedBranch, si existe, YA es un Branch['id'] real de la sesion
  // (Tanda 5, ADR-006) — se toma su .id tipado en vez de re-envolver
  // el string crudo de localStorage con asBranchId (que ademas
  // lanzaria si alguna vez el storage tuviera un valor con otro
  // formato, cosa que este chequeo ya descarto).
  return storedBranch ? storedBranch.id : session.defaultBranchId;
}

// Al cerrar la sesion (logout o refresh fallido) no puede quedar nada del
// usuario anterior: ni datos en cache ni stores de modulo.
function clearUserData(): void {
  queryClient.clear();
  resetAllStores();
}

export const useSessionStore = create<SessionState>()((set, get) => ({
  session: null,
  activeBranchId: null,
  status: 'idle',
  isLoading: false,
  error: null,

  loadSession: async () => {
    // Idempotente: evita un segundo fetch si ya cargo o esta cargando
    // (por ejemplo, doble efecto de montaje en React StrictMode). Con auth
    // por http, tampoco reintenta despues de un 'unauthenticated': eso lo
    // resuelve el login.
    if (get().session || get().isLoading || get().status === 'unauthenticated') {
      return { success: get().session !== null };
    }

    set({ isLoading: true, status: 'loading', error: null });

    try {
      if (AUTH_IS_HTTP && !(await httpClient.refreshAccessToken())) {
        set({ isLoading: false, status: 'unauthenticated' });
        return { success: false };
      }
      const session = AUTH_IS_HTTP ? await authService.fetchCurrentSession() : await fetchSession();
      set({ session, activeBranchId: resolveInitialBranchId(session), isLoading: false, status: 'authenticated' });
      return { success: true };
    } catch {
      set({ isLoading: false, status: 'error', error: 'No se pudo cargar la sesion.' });
      return { success: false, reason: 'fetch-error' };
    }
  },

  login: async (email, password) => {
    try {
      const session = await authService.login(email, password);
      clearUserData();
      set({ session, activeBranchId: resolveInitialBranchId(session), status: 'authenticated', isLoading: false, error: null });
      return { success: true };
    } catch (err) {
      if (err instanceof ApiError && err.serverCode === 'invalid-credentials') return { success: false, reason: 'invalid-credentials' };
      if (err instanceof ApiError && (err.code === 'NETWORK_ERROR' || err.code === 'TIMEOUT')) return { success: false, reason: 'network' };
      return { success: false, reason: 'unknown' };
    }
  },

  logout: async () => {
    try {
      if (AUTH_IS_HTTP) await authService.logout();
    } finally {
      clearUserData();
      set({ session: null, activeBranchId: null, status: AUTH_IS_HTTP ? 'unauthenticated' : 'idle' });
    }
  },

  setActiveBranch: (branchId) => {
    const branch = get().session?.branches.find((b) => b.id === branchId);

    if (!branch) {
      return { success: false, branchId, reason: 'not-found' };
    }

    if (branch.status !== 'active') {
      return { success: false, branchId, reason: 'inactive' };
    }

    set({ activeBranchId: branchId });
    localStorage.setItem(ACTIVE_BRANCH_STORAGE_KEY, branchId);
    // Evita mostrar datos de negocio de la sucursal anterior bajo el
    // rotulo de la nueva (ver DECISIONES_TECNICAS.md, D5).
    resetAllStores();

    return { success: true, branchId };
  },
}));

// Un refresh fallido en medio de la sesion (httpClient, ante un 401): la
// sesion termino. RequireSession ve 'unauthenticated' y manda al login.
onSessionExpired(() => {
  if (useSessionStore.getState().status !== 'authenticated') return;
  clearUserData();
  useSessionStore.setState({ session: null, activeBranchId: null, status: 'unauthenticated' });
});
