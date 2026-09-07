import { useState } from 'react';
import { EVIDENCE_LIMITS, signUpload, confirmUpload } from '@/shared/api/uploads/uploads.service';

// ============================================================
// useEvidenceUpload — ADR-005 (Tanda 8, corrida completa): gestiona
// una lista de archivos de evidencia con estado individual por
// archivo. Valida limites ANTES de intentar subir nada (nunca se
// arranca una subida que ya sabemos que va a fallar por tamaño/tipo).
// Si una subida falla, el archivo queda en estado 'error' y puede
// reintentarse SOLO ese archivo — el resto no se ve afectado (ADR-005:
// "el evento no se envia a medias").
// ============================================================

export type EvidenceFileStatus = 'pendiente' | 'subiendo' | 'listo' | 'error';

export interface EvidenceFileState {
  localId: string;
  file: File;
  status: EvidenceFileStatus;
  fileId?: string;
  errorMessage?: string;
}

function validateFile(file: File, currentCount: number): string | null {
  if (currentCount >= EVIDENCE_LIMITS.maxFiles) {
    return `Maximo ${EVIDENCE_LIMITS.maxFiles} archivos por evento.`;
  }
  if (file.size > EVIDENCE_LIMITS.maxSizeBytes) {
    return `"${file.name}" supera el tamaño maximo (10 MB).`;
  }
  if (!EVIDENCE_LIMITS.acceptedTypes.includes(file.type as (typeof EVIDENCE_LIMITS.acceptedTypes)[number])) {
    return `"${file.name}" no es un formato aceptado (solo JPEG, PNG, WEBP o PDF).`;
  }
  return null;
}

async function uploadOne(entry: EvidenceFileState): Promise<EvidenceFileState> {
  try {
    const { fileId } = await signUpload(entry.file.name, entry.file.type);
    await confirmUpload(fileId, entry.file);
    return { ...entry, status: 'listo', fileId, errorMessage: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'No se pudo subir el archivo.';
    return { ...entry, status: 'error', errorMessage: message };
  }
}

export function useEvidenceUpload() {
  const [files, setFiles] = useState<EvidenceFileState[]>([]);
  const [rejectedMessages, setRejectedMessages] = useState<string[]>([]);

  function addFiles(newFiles: FileList | File[]) {
    const rejected: string[] = [];
    const accepted: EvidenceFileState[] = [];
    let runningCount = files.length;

    for (const file of Array.from(newFiles)) {
      const error = validateFile(file, runningCount);
      if (error) {
        rejected.push(error);
        continue;
      }
      runningCount += 1;
      accepted.push({ localId: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`, file, status: 'pendiente' });
    }

    setRejectedMessages(rejected);
    setFiles((prev) => [...prev, ...accepted]);

    for (const entry of accepted) {
      setFiles((prev) => prev.map((f) => (f.localId === entry.localId ? { ...f, status: 'subiendo' } : f)));
      void uploadOne(entry).then((result) => {
        setFiles((prev) => prev.map((f) => (f.localId === entry.localId ? result : f)));
      });
    }
  }

  function retry(localId: string) {
    const entry = files.find((f) => f.localId === localId);
    if (!entry || entry.status !== 'error') return;

    setFiles((prev) => prev.map((f) => (f.localId === localId ? { ...f, status: 'subiendo', errorMessage: undefined } : f)));
    void uploadOne(entry).then((result) => {
      setFiles((prev) => prev.map((f) => (f.localId === localId ? result : f)));
    });
  }

  function remove(localId: string) {
    setFiles((prev) => prev.filter((f) => f.localId !== localId));
  }

  function reset() {
    setFiles([]);
    setRejectedMessages([]);
  }

  const uploadedFileIds = files.filter((f) => f.status === 'listo' && f.fileId).map((f) => f.fileId as string);
  const isUploading = files.some((f) => f.status === 'subiendo');
  const hasErrors = files.some((f) => f.status === 'error');

  return { files, rejectedMessages, addFiles, retry, remove, reset, uploadedFileIds, isUploading, hasErrors };
}
