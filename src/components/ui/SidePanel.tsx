import { useEffect, type FC, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './SidePanel.css';

// ============================================================
// SidePanel — Right-side sliding detail panel
// ============================================================

interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  headerActions?: ReactNode;
}

const IconClose: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const SidePanel: FC<SidePanelProps> = ({ isOpen, onClose, title, subtitle, children, headerActions }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="side-panel-overlay" onClick={onClose} aria-modal="true" role="dialog">
      <div
        className="side-panel"
        onClick={(e) => e.stopPropagation()}
        aria-label={title}
      >
        <header className="side-panel__header">
          <div className="side-panel__header-info">
            <h3 className="side-panel__title">{title}</h3>
            {subtitle && <p className="side-panel__subtitle">{subtitle}</p>}
          </div>
          <div className="side-panel__header-actions">
            {headerActions}
            <button
              className="side-panel__close-btn"
              onClick={onClose}
              aria-label="Cerrar panel"
            >
              <IconClose className="side-panel__close-icon" />
            </button>
          </div>
        </header>
        <div className="side-panel__body">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};
