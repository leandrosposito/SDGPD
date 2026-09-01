import type { SessionUser } from '@/shared/types/session.types';
import { SESSION_MOCK_DATA } from '@/data/mock/session.mock';

// ============================================================
// SESSION SERVICE — Simulates async API calls
// Replace this implementation with a real fetch/axios call
// when the backend API is available (la sesion vendra resuelta
// por el backend segun el token/cookie autenticado).
// ============================================================

const SIMULATED_DELAY_MS = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchSession(): Promise<SessionUser> {
  await delay(SIMULATED_DELAY_MS);
  return structuredClone(SESSION_MOCK_DATA);
}
