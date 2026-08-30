import type { FC } from 'react';
import '@/modules/settings/SettingsPage.css';

export const TabCommercial: FC = () => {
  return (
    <>
      <h3 className="settings-section-title">Políticas de Venta</h3>
      <div className="settings-form-grid">
        <div className="settings-form-group">
          <label className="settings-label">Límite Global de Crédito ($)</label>
          <input type="number" className="settings-input" defaultValue={500000} />
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>Monto máximo permitido en cuenta corriente antes de bloquear ventas.</span>
        </div>
        <div className="settings-form-group">
          <label className="settings-label">Días de Vencimiento Predeterminados</label>
          <input type="number" className="settings-input" defaultValue={15} />
        </div>
      </div>

      <div className="divider"></div>

      <h3 className="settings-section-title">Listas de Precios Activas</h3>
      <div className="settings-form-group" style={{ maxWidth: '30rem' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
          <input type="text" className="settings-input" defaultValue="Lista Base (Mostrador)" />
          <button className="client-modal-btn client-modal-btn--outline">Editar</button>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
          <input type="text" className="settings-input" defaultValue="Lista Mayorista (-10%)" />
          <button className="client-modal-btn client-modal-btn--outline">Editar</button>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <input type="text" className="settings-input" placeholder="Nueva lista..." />
          <button className="client-modal-btn client-modal-btn--primary">Agregar</button>
        </div>
      </div>

      <div className="divider"></div>

      <h3 className="settings-section-title">Integración WhatsApp Business</h3>
      <div style={{ background: 'var(--color-bg-base)', padding: 'var(--space-5)', borderRadius: 'var(--radius-lg)', border: '0.0625rem solid var(--color-success)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
          </svg>
          <div>
            <div style={{ fontWeight: 'var(--font-weight-bold)' }}>WhatsApp Vinculado</div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>+54 9 11 1234-5678</div>
          </div>
          <button className="client-modal-btn client-modal-btn--outline" style={{ marginLeft: 'auto' }}>Desvincular</button>
        </div>
        
        <div className="settings-form-group">
          <label className="settings-label">Plantilla de Mensaje Automático (Remito)</label>
          <textarea 
            className="settings-input" 
            style={{ minHeight: '6rem' }}
            defaultValue="Hola {cliente}, tu pedido {pedido} ya está en camino con nuestro chofer. Monto a abonar: {monto}. ¡Gracias por confiar en nosotros!"
          />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
        <button className="client-modal-btn client-modal-btn--primary">Guardar Configuración</button>
      </div>
    </>
  );
};
