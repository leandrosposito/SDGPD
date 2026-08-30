import type { FC } from 'react';
import { SETTINGS_MOCK_AUDIT } from '@/data/mock/settings.data';
import '@/modules/settings/SettingsPage.css';

export const AuditLogWidget: FC = () => {
  return (
    <div className="settings-widget">
      <div className="settings-widget__title">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
        Registro de Auditoría
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
        {SETTINGS_MOCK_AUDIT.map((log) => (
          <div key={log.id} className="settings-audit-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="settings-audit-user">{log.user}</span>
              <span className="settings-audit-time">{log.timestamp}</span>
            </div>
            <div className="settings-audit-action">{log.action}</div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>{log.details}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
