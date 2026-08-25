import { type FC } from 'react';

interface ClientActionBarProps {
  onNewClient: () => void;
}

export const ClientActionBar: FC<ClientActionBarProps> = ({ onNewClient }) => {
  return (
    <div className="client-action-bar">
      <button className="client-modal-btn client-modal-btn--outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Exportar a Excel
      </button>
      <button className="client-modal-btn client-modal-btn--primary" onClick={onNewClient}>
        Nuevo Cliente
      </button>
    </div>
  );
};
