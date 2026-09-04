import type { FC } from 'react';
import { Loader2 } from 'lucide-react';
import './LoadingState.css';

// ============================================================
// LoadingState — Indicador de carga generico para una seccion
// completa (a diferencia de SkeletonLoader/SkeletonTable, que
// imitan la forma del contenido final: este es para el caso en que
// todavia no hay nada que "esbozar", ej. la primera carga de una
// pantalla entera). Sin conocimiento de dominio. No se cablea en
// ningun listado todavia — solo se crea la infraestructura.
// ============================================================

interface LoadingStateProps {
  message?: string;
}

export const LoadingState: FC<LoadingStateProps> = ({ message = 'Cargando...' }) => (
  <div className="loading-state" role="status" aria-live="polite">
    <Loader2 className="loading-state__spinner" size={24} aria-hidden="true" />
    <span className="loading-state__message">{message}</span>
  </div>
);
