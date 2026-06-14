import type { FC } from 'react';
import './TabImportExport.css';

// ============================================================
// TabImportExport — Zona de arrastrar y soltar para carga masiva
// ============================================================

export const TabImportExport: FC = () => {
  return (
    <div className="tab-importexport">
      <header className="tab-importexport__header">
        <h3 className="tab-importexport__title">Importar / Exportar Datos</h3>
        <p className="tab-importexport__subtitle">Actualiza tu stock o precios de forma masiva subiendo una planilla Excel o CSV.</p>
      </header>

      <div className="tab-importexport__grid">
        <div className="tab-importexport__card">
          <div className="tab-importexport__card-header">
            <h4>Importar Archivo</h4>
          </div>
          <div className="tab-importexport__dropzone">
            <div className="tab-importexport__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
              </svg>
            </div>
            <p className="tab-importexport__dropzone-text">
              Arrastra y suelta tu archivo aquí o <span>explora</span>
            </p>
            <p className="tab-importexport__dropzone-sub">
              Formatos soportados: .xlsx, .csv (Max 10MB)
            </p>
          </div>
        </div>

        <div className="tab-importexport__card">
          <div className="tab-importexport__card-header">
            <h4>Exportar Datos</h4>
          </div>
          <div className="tab-importexport__export-options">
            <p className="text-secondary text-sm mb-4">
              Descarga la base de datos actual para realizar copias de seguridad o editarla externamente.
            </p>
            <div className="tab-importexport__btn-group">
              <button className="tab-importexport__btn tab-importexport__btn--outline">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Exportar Inventario (CSV)
              </button>
              <button className="tab-importexport__btn tab-importexport__btn--outline">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Exportar Lista de Precios
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
