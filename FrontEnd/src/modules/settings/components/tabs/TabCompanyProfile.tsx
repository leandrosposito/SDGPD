import type { FC } from 'react';
import '../../SettingsPage.css';

export const TabCompanyProfile: FC = () => {
  return (
    <>
      <h3 className="settings-section-title">Perfil de la Empresa</h3>
      <div className="settings-form-grid">
        <div className="settings-form-group">
          <label className="settings-label">Razón Social</label>
          <input type="text" className="settings-input" defaultValue="Distribuidora Global S.A." />
        </div>
        <div className="settings-form-group">
          <label className="settings-label">CUIT</label>
          <input type="text" className="settings-input" defaultValue="30-71234567-8" />
        </div>
        <div className="settings-form-group">
          <label className="settings-label">Condición frente al IVA</label>
          <select className="settings-select" defaultValue="RI">
            <option value="RI">Responsable Inscripto</option>
            <option value="MT">Monotributista</option>
            <option value="EX">Exento</option>
          </select>
        </div>
        <div className="settings-form-group">
          <label className="settings-label">Domicilio Comercial</label>
          <input type="text" className="settings-input" defaultValue="Av. Corrientes 1234, CABA" />
        </div>
      </div>

      <div className="divider"></div>

      <h3 className="settings-section-title">Configuración Regional</h3>
      <div className="settings-form-grid">
        <div className="settings-form-group">
          <label className="settings-label">Moneda Base</label>
          <select className="settings-select" defaultValue="ARS">
            <option value="ARS">Pesos Argentinos (ARS)</option>
            <option value="USD">Dólar Estadounidense (USD)</option>
            <option value="EUR">Euros (EUR)</option>
          </select>
        </div>
        <div className="settings-form-group">
          <label className="settings-label">Formato de Visualización</label>
          <select className="settings-select" defaultValue="symbol">
            <option value="symbol">$ 1.500,00</option>
            <option value="code">ARS 1.500,00</option>
          </select>
        </div>
      </div>

      <div className="divider"></div>

      <h3 className="settings-section-title">Logo Oficial</h3>
      <div className="settings-dropzone">
        <svg className="settings-dropzone-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        <span className="settings-label" style={{ color: 'var(--color-text-primary)' }}>Arrastra tu logo aquí o haz clic para buscar</span>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>Recomendado: PNG fondo transparente. Se aplicará en remitos y facturas.</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
        <button className="client-modal-btn client-modal-btn--primary">Guardar Cambios</button>
      </div>
    </>
  );
};
