import { useState, type FC } from 'react';
import { Modal } from '@/shared/components/ui/Modal';
import { type LogisticsOrder } from '@/shared/types/logistics.types';
import '../LogisticsPage.css';

interface DeliveryProofModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: LogisticsOrder | null;
  onConfirmDelivery: (orderId: string) => void;
}

export const DeliveryProofModal: FC<DeliveryProofModalProps> = ({ isOpen, onClose, order, onConfirmDelivery }) => {
  const [isDragActive, setIsDragActive] = useState(false);

  if (!order) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Confirmar Entrega - Pedido ${order.orderNumber}`}
      footer={
        <div className="modal-footer">
          <button className="client-modal-btn client-modal-btn--outline" onClick={onClose}>Cancelar</button>
          <button className="client-modal-btn client-modal-btn--primary" onClick={() => onConfirmDelivery(order.id)}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            Confirmar Entrega
          </button>
        </div>
      }
    >
      <div className="delivery-proof-form">
        
        <div className="delivery-proof-header">
          <h4 className="delivery-proof-client">{order.clientName}</h4>
          <span className="delivery-proof-address">{order.address}</span>
        </div>

        <div className="client-form-group">
          <label className="client-form-label">Evidencia de Entrega</label>
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
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <span className="document-dropzone__text">Adjuntar Remito Firmado / Evidencia fotografica</span>
            <span className="document-dropzone__help">Arrastra el archivo o haz clic para subir</span>
          </div>
        </div>

        <div className="client-form-group" style={{ marginTop: 'var(--space-4)' }}>
          <label className="client-form-label">Observaciones de Entrega</label>
          <textarea 
            className="client-form-input client-form-textarea" 
            rows={3} 
            placeholder="Ej: Local cerrado, bultos rotos, entregado a un vecino..."
          ></textarea>
        </div>

      </div>
    </Modal>
  );
};
