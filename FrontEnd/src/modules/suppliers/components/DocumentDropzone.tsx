import { useState, type FC } from 'react';
import './SupplierModals.css';

export const DocumentDropzone: FC = () => {
  const [isDragActive, setIsDragActive] = useState(false);

  return (
    <div 
      className={`document-dropzone ${isDragActive ? 'document-dropzone--drag-active' : ''}`}
      onDragEnter={() => setIsDragActive(true)}
      onDragLeave={() => setIsDragActive(false)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragActive(false);
      }}
    >
      <svg 
        className="document-dropzone__icon" 
        viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="17 8 12 3 7 8"></polyline>
        <line x1="12" y1="3" x2="12" y2="15"></line>
      </svg>
      <span className="document-dropzone__text">Adjuntar Documentacion Legal (PDF/Imagenes)</span>
      <span className="document-dropzone__help">Sube aqui Constancias AFIP, Contratos o Certificados de Exencion</span>
    </div>
  );
};
