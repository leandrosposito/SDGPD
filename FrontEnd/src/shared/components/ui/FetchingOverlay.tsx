import type { FC, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import './FetchingOverlay.css';

// ============================================================
// FetchingOverlay — Envuelve contenido paginado (una Table, etc.).
// Mientras `isFetching` es true mantiene el contenido anterior visible
// (atenuado) y muestra un indicador de carga encima, en vez de vaciarlo
// (P5, DECISIONES_TECNICAS.md): evita el salto de layout y el
// parpadeo de "tabla vacia" en cada cambio de pagina/tamaño/orden.
// Generico, sin conocimiento de dominio — usado por LogisticsPage y
// TabLowStock.
// ============================================================

interface FetchingOverlayProps {
  isFetching: boolean;
  children: ReactNode;
}

export const FetchingOverlay: FC<FetchingOverlayProps> = ({ isFetching, children }) => (
  <div className="fetching-overlay" aria-busy={isFetching}>
    <div
      className={`fetching-overlay__content${isFetching ? ' fetching-overlay__content--dimmed' : ''}`}
    >
      {children}
    </div>
    {isFetching && (
      <div className="fetching-overlay__indicator" role="status" aria-live="polite">
        <Loader2 className="fetching-overlay__spinner" size={18} aria-hidden="true" />
        <span className="fetching-overlay__text">Actualizando...</span>
      </div>
    )}
  </div>
);
