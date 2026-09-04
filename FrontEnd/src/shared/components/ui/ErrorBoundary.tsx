import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { logError } from '@/shared/utils/logError';
import './ErrorBoundary.css';

// ============================================================
// ErrorBoundary — Aisla errores de render de una seccion para
// que no rompan la pantalla completa. Debe ser clase (React no
// tiene equivalente en hooks para getDerivedStateFromError).
//
// Dos usos en el proyecto (ver DECISIONES_TECNICAS.md, entrada de
// contencion de errores):
// - Local, por listado (6 usos ya existentes: ClientAccountsTable,
//   ClientOverdueTable, TabPendingReceipt, ComprasPage, TabLowStock,
//   LogisticsPage) — pasan solo fallbackTitle/fallbackMessage, sin
//   resetKey (no hay "ruta" que resetee un panel dentro de una
//   pagina). Siguen funcionando igual, retrocompatibles.
// - Global y por ruta (AppRoutes.tsx / AppShell.tsx) — usan ademas
//   resetKey (atado al pathname en el boundary de ruta, para que
//   navegar a otra pantalla limpie el estado de error sin recargar)
//   y se benefician del fallback por default con "Reintentar"/
//   "Volver al inicio".
//
// `fallback` (render prop) permite un fallback a medida cuando el
// default (icono + titulo + mensaje + acciones) no aplica; si no se
// pasa, se usa el default con fallbackTitle/fallbackMessage.
// ============================================================

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (args: { error: unknown; reset: () => void }) => ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
  // Cuando cambia (por referencia/valor) mientras hay un error, el
  // boundary se resetea automaticamente — pensado para atarlo a
  // location.pathname en el boundary de ruta (ver AppShell.tsx).
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: unknown;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logError(error, { componentStack: errorInfo.componentStack });
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // Reseteo automatico por cambio de ruta (o de cualquier resetKey):
    // no llama a onReset a proposito — es un reseteo silencioso por
    // navegacion, no una accion explicita del usuario como "Reintentar".
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback({ error: this.state.error, reset: this.handleReset });
      }

      return (
        <div className="error-boundary" role="alert">
          <AlertTriangle className="error-boundary__icon" size={20} aria-hidden="true" />
          <div className="error-boundary__body">
            <p className="error-boundary__title">
              {this.props.fallbackTitle ?? 'Ocurrio un error al mostrar esta seccion.'}
            </p>
            <p className="error-boundary__message">
              {this.props.fallbackMessage ?? 'Intenta de nuevo o volve al inicio.'}
            </p>
            <div className="error-boundary__actions">
              <button
                type="button"
                className="error-boundary__button error-boundary__button--primary"
                onClick={this.handleReset}
              >
                <RefreshCw size={14} aria-hidden="true" />
                Reintentar
              </button>
              <Link
                to="/"
                className="error-boundary__button error-boundary__button--secondary"
                onClick={this.handleReset}
              >
                <Home size={14} aria-hidden="true" />
                Volver al inicio
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
