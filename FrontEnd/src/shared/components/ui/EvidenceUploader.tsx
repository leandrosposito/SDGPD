import type { FC } from 'react';
import { useRef } from 'react';
import { Paperclip, X, RotateCcw, CheckCircle2, AlertCircle, Loader2, type LucideIcon } from 'lucide-react';
import type { EvidenceFileState } from '@/shared/hooks/useEvidenceUpload';
import './EvidenceUploader.css';

// ============================================================
// EvidenceUploader — UI minima de ADR-005 (Tanda 8, corrida completa):
// lista de archivos con estado individual, reintento por archivo. No
// conoce uploads.service.ts ni useEvidenceUpload por dentro — recibe
// todo por props (mismo criterio que ExportButton: un componente de
// presentacion sobre un hook que vive aparte).
// ============================================================

interface EvidenceUploaderProps {
  files: EvidenceFileState[];
  rejectedMessages: string[];
  onAddFiles: (files: FileList) => void;
  onRetry: (localId: string) => void;
  onRemove: (localId: string) => void;
}

const STATUS_ICON: Record<EvidenceFileState['status'], LucideIcon> = {
  pendiente: Loader2,
  subiendo: Loader2,
  listo: CheckCircle2,
  error: AlertCircle,
};

export const EvidenceUploader: FC<EvidenceUploaderProps> = ({ files, rejectedMessages, onAddFiles, onRetry, onRemove }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="evidence-uploader">
      <button type="button" className="evidence-uploader__trigger" onClick={() => inputRef.current?.click()}>
        <Paperclip size={14} aria-hidden="true" />
        Adjuntar evidencia (fotos o PDF)
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="evidence-uploader__input"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) onAddFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {rejectedMessages.length > 0 && (
        <ul className="evidence-uploader__rejected">
          {rejectedMessages.map((message, i) => (
            <li key={i}>{message}</li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <ul className="evidence-uploader__list">
          {files.map((f) => {
            const Icon = STATUS_ICON[f.status];
            const spinning = f.status === 'pendiente' || f.status === 'subiendo';
            return (
              <li key={f.localId} className={`evidence-uploader__item evidence-uploader__item--${f.status}`}>
                <Icon size={14} className={spinning ? 'evidence-uploader__spin' : undefined} />
                <span className="evidence-uploader__name">{f.file.name}</span>
                {f.status === 'error' && (
                  <>
                    <span className="evidence-uploader__error">{f.errorMessage}</span>
                    <button type="button" className="evidence-uploader__retry" onClick={() => onRetry(f.localId)} aria-label={`Reintentar subida de ${f.file.name}`}>
                      <RotateCcw size={12} />
                    </button>
                  </>
                )}
                <button type="button" className="evidence-uploader__remove" onClick={() => onRemove(f.localId)} aria-label={`Quitar ${f.file.name}`}>
                  <X size={12} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
