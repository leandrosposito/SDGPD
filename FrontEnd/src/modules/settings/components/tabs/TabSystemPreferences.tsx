import type { FC } from 'react';
import '@/modules/settings/SettingsPage.css';

export const TabSystemPreferences: FC = () => {
  return (
    <>
      <h3 className="settings-section-title">Preferencias de Impresión</h3>
      <div className="settings-form-grid">
        <div className="settings-form-group">
          <label className="settings-label">Formato de Remitos y Facturas</label>
          <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
              <input type="radio" name="printFormat" value="a4" defaultChecked /> A4 (Oficina)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
              <input type="radio" name="printFormat" value="ticket" /> Ticket 80mm (Punto de Venta)
            </label>
          </div>
        </div>
        <div className="settings-form-group">
          <label className="settings-label">Copias por Defecto</label>
          <input type="number" className="settings-input" defaultValue={2} style={{ width: '5rem' }} />
        </div>
      </div>

      <div className="divider"></div>

      <h3 className="settings-section-title">Integración Fiscal (AFIP WebServices)</h3>
      <div className="settings-form-grid">
        <div className="settings-form-group">
          <label className="settings-label">Certificado (CRT)</label>
          <button className="client-modal-btn client-modal-btn--outline">Subir archivo .crt</button>
        </div>
        <div className="settings-form-group">
          <label className="settings-label">Clave Privada (KEY)</label>
          <button className="client-modal-btn client-modal-btn--outline">Subir archivo .key</button>
        </div>
        <div className="settings-form-group">
          <label className="settings-label">Punto de Venta Asociado</label>
          <input type="number" className="settings-input" defaultValue={3} />
        </div>
        <div className="settings-form-group">
          <label className="settings-label">Entorno</label>
          <select className="settings-select" defaultValue="homo">
            <option value="homo">Homologación (Testing)</option>
            <option value="prod">Producción (Real)</option>
          </select>
        </div>
      </div>

      <div className="divider"></div>

      <h3 className="settings-section-title">Cuentas Bancarias y Recaudación</h3>
      <div className="settings-form-group" style={{ maxWidth: '40rem' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
          <input type="text" className="settings-input" defaultValue="Banco Santander - Cta Cte 123/4" style={{ flex: 1 }} />
          <input type="text" className="settings-input" defaultValue="CBU: 07200000000000000" style={{ flex: 1 }} />
          <button className="client-modal-btn client-modal-btn--outline">X</button>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
          <input type="text" className="settings-input" defaultValue="Mercado Pago - CVU Corporativo" style={{ flex: 1 }} />
          <input type="text" className="settings-input" defaultValue="CVU: 00000031000000000" style={{ flex: 1 }} />
          <button className="client-modal-btn client-modal-btn--outline">X</button>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <input type="text" className="settings-input" placeholder="Nombre Banco/Billetera" style={{ flex: 1 }} />
          <input type="text" className="settings-input" placeholder="CBU/CVU o Alias" style={{ flex: 1 }} />
          <button className="client-modal-btn client-modal-btn--primary">+ Añadir</button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
        <button className="client-modal-btn client-modal-btn--primary">Guardar Preferencias</button>
      </div>
    </>
  );
};
