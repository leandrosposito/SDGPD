import type { FC } from 'react';
import '../../SettingsPage.css';

export const BackupWidget: FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Wizard */}
      <div className="settings-widget" style={{ borderColor: 'var(--color-accent)', background: 'var(--color-bg-subtle)' }}>
        <div className="settings-widget__title" style={{ color: 'var(--color-accent-light)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
          Asistente de Configuración
        </div>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
          Configura tu distribuidora paso a paso en 5 minutos.
        </div>
        <button className="client-modal-btn client-modal-btn--primary">Iniciar Wizard</button>
      </div>

      {/* Backup */}
      <div className="settings-widget">
        <div className="settings-widget__title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Resguardo de Datos
        </div>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
          Último backup automático: Hoy a las 03:00 AM.
        </div>
        <button className="client-modal-btn client-modal-btn--outline">Descargar SQL Completo</button>
      </div>
    </div>
  );
};
