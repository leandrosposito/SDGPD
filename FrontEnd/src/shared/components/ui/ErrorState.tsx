import type { FC } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import './ErrorState.css';

// ============================================================
// ErrorState — Estado de error para una operacion async que ya
// resolvio (a diferencia de ErrorBoundary, que atrapa errores de
// RENDER): usarlo cuando `error` de un hook de fetching (ej.
// usePagedQuery) esta seteado, para mostrarlo en vez del contenido.
// Generico, sin conocimiento de dominio. No se cablea en ningun
// listado todavia — solo se crea la infraestructura.
// ============================================================

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: FC<ErrorStateProps> = ({
  message = 'No se pudo cargar la informacion.',
  onRetry,
}) => (
  <div className="error-state" role="alert">
    <AlertTriangle className="error-state__icon" size={24} aria-hidden="true" />
    <p className="error-state__message">{message}</p>
    {onRetry && (
      <button type="button" className="error-state__retry" onClick={onRetry}>
        <RefreshCw size={14} aria-hidden="true" />
        Reintentar
      </button>
    )}
  </div>
);
