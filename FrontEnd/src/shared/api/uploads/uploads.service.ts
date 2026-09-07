// ============================================================
// uploads.service — Simulacion de subida directa a storage con URL
// prefirmada (ADR-005, Tanda 8 de la corrida completa).
//
// NO pasa por httpClient a proposito: httpClient.ts modela peticiones
// JSON contra el backend de la app (`body?: unknown` se serializa como
// JSON en modo http) — un archivo (`File`) no es un payload JSON, y el
// punto entero de ADR-005 es que el archivo va DIRECTO a storage, sin
// pasar por el backend de la app. Sin backend real ni storage real,
// esta simulacion es lo mas honesto que se puede hacer: un `delay()`
// propio (mismo patron que cualquier service sin backend real) en vez
// de forzar el archivo dentro de un contrato pensado para JSON.
//
// Limites (ADR-005): maximo 5 archivos por evento, 10 MB cada uno,
// tipos aceptados imagen (jpeg/png/webp) o PDF — se validan en
// useEvidenceUpload.ts ANTES de llamar a este service (nunca se
// intenta subir un archivo que ya sabemos que no cumple).
// ============================================================

export const EVIDENCE_LIMITS = {
  maxFiles: 5,
  maxSizeBytes: 10 * 1024 * 1024,
  acceptedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const,
};

export type AcceptedEvidenceType = (typeof EVIDENCE_LIMITS.acceptedTypes)[number];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let uploadCounter = 0;

export interface SignUploadResult {
  uploadUrl: string;
  fileId: string;
}

// Mock de "POST /uploads/sign": no hay storage real detras, asi que la
// "uploadUrl" es un placeholder (nunca se le hace un PUT real) — lo
// unico que un backend real necesitaria devolver aca es el par
// (uploadUrl, fileId); el cliente PUTearia el archivo a uploadUrl en
// un mundo con storage real.
export async function signUpload(fileName: string, fileType: string): Promise<SignUploadResult> {
  await delay(150);
  uploadCounter += 1;
  const fileId = `evd-${Date.now()}-${uploadCounter}`;
  const query = `name=${encodeURIComponent(fileName)}&type=${encodeURIComponent(fileType)}`;
  return { uploadUrl: `mock://uploads/${fileId}?${query}`, fileId };
}

export interface ConfirmUploadResult {
  fileId: string;
}

// Simula el PUT del archivo a `uploadUrl` + la confirmacion. Fallo
// deterministico simple (1 de cada 8) para poder ejercitar el
// reintento parcial de useEvidenceUpload.ts sin depender del azar real
// de VITE_MOCK_FAILURE_RATE (que es una politica de RED, no de esta
// simulacion de storage).
export async function confirmUpload(fileId: string, file: File): Promise<ConfirmUploadResult> {
  await delay(300 + Math.min(file.size / 1024, 400));
  uploadCounter += 1;
  if (uploadCounter % 8 === 0) {
    throw new Error(`No se pudo subir "${file.name}". Intenta de nuevo.`);
  }
  return { fileId };
}
