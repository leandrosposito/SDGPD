import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import './ErrorBoundary.css';

// ============================================================
// ErrorBoundary — Aisla errores de render de una seccion para
// que no rompan la pantalla completa. Debe ser clase (React no
// tiene equivalente en hooks para getDerivedStateFromError).
// ============================================================

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="error-boundary" role="alert">
          <AlertTriangle className="error-boundary__icon" size={20} aria-hidden="true" />
          <div>
            <p className="error-boundary__title">
              {this.props.fallbackTitle ?? 'Ocurrio un error al mostrar esta seccion.'}
            </p>
            <p className="error-boundary__message">
              {this.props.fallbackMessage ?? 'Recarga la pagina para intentar de nuevo.'}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
