import { create } from 'zustand';
import type { Branch, SessionUser } from '@/shared/types/session.types';
import { fetchSession } from '@/services/mock/session.service';
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
// ============================================================

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
  isLoading: boolean;
  error: string | null;
  loadSession: () => Promise<SessionLoadResult>;
  setActiveBranch: (branchId: Branch['id']) => SetActiveBranchResult;
}

// La sucursal guardada es solo una conveniencia de UX (recordar la
// ultima eleccion entre recargas), no una autorizacion: el backend
// real debera validar igual que la sucursal pedida pertenezca a la
// empresa de la sesion autenticada antes de servir cualquier dato.
function resolveInitialBranchId(session: SessionUser): Branch['id'] {
  const storedBranchId = localStorage.getItem(ACTIVE_BRANCH_STORAGE_KEY);
  const storedBranchIsUsable = session.branches.some(
    (branch) => branch.id === storedBranchId && branch.status === 'active'
  );

  return storedBranchIsUsable ? (storedBranchId as string) : session.defaultBranchId;
}

export const useSessionStore = create<SessionState>()((set, get) => ({
  session: null,
  activeBranchId: null,
  isLoading: false,
  error: null,

  loadSession: async () => {
    // Idempotente: evita un segundo fetch si ya cargo o esta cargando
    // (por ejemplo, doble efecto de montaje en React StrictMode).
    if (get().session || get().isLoading) {
      return { success: true };
    }

    set({ isLoading: true, error: null });

    try {
      const session = await fetchSession();
      set({ session, activeBranchId: resolveInitialBranchId(session), isLoading: false });
      return { success: true };
    } catch {
      set({ isLoading: false, error: 'No se pudo cargar la sesion.' });
      return { success: false, reason: 'fetch-error' };
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
