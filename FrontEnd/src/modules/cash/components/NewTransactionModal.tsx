import { useState, useEffect, type FC } from 'react';
import { Modal } from '../../../shared/components/ui/Modal';
import { TransactionTypeSelector } from './TransactionTypeSelector';
import { TransactionDropzone } from './TransactionDropzone';
import type { TransactionType } from '../../../shared/types/cash.types';
import './CashTransactionModal.css';

interface NewTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
}

export const NewTransactionModal: FC<NewTransactionModalProps> = ({ isOpen, onClose, onSave }) => {
  const [type, setType] = useState<TransactionType>('income');
  const [currentTime, setCurrentTime] = useState<string>('');
  
  // Data form
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<string>('gasto');
  const [entity, setEntity] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('efectivo');
  const [reference, setReference] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [costCenter, setCostCenter] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      // Set initial time when opening
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }));
      // Reset defaults
      setAmount('');
      setReference('');
      setDescription('');
    }
  }, [isOpen]);

  const handleSave = (loadAnother: boolean = false) => {
    onSave({
      type,
      category,
      amount: Number(amount),
      description,
      entity: entity || 'N/A',
      linkedVoucher: reference,
      time: currentTime
    });

    if (loadAnother) {
      setAmount('');
      setReference('');
      setDescription('');
      // Mantener el tipo y categoria puede ser util para cargas repetitivas
    }
  };

  const isFormValid = amount && Number(amount) > 0 && category;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nuevo Movimiento de Caja">
      {/* Wrapper dinámico que inyecta las variables CSS de color (Verde/Rojo) basado en el tipo */}
      <div className="cash-modal-container" data-type={type}>
        
        {/* 1. Datos Principales */}
        <TransactionTypeSelector value={type} onChange={setType} />

        <div className="tx-form-grid">
          <div className="tx-form-group">
            <label className="tx-label">Fecha y Hora</label>
            <input 
              type="time" 
              className="tx-input" 
              value={currentTime}
              onChange={(e) => setCurrentTime(e.target.value)}
            />
          </div>
          <div className="tx-form-group">
            <label className="tx-label">Categoría</label>
            <select className="tx-select" value={category} onChange={(e) => setCategory(e.target.value)}>
              {type === 'income' ? (
                <>
                  <option value="cobro">Cobro a Cliente</option>
                  <option value="anticipo_ingreso">Anticipo Recibido</option>
                  <option value="aporte">Aporte de Capital</option>
                  <option value="otros_ingresos">Otros Ingresos</option>
                </>
              ) : (
                <>
                  <option value="gasto">Gasto Operativo</option>
                  <option value="pago_proveedor">Pago a Proveedor</option>
                  <option value="retiro">Retiro Dueño</option>
                  <option value="anticipo_egreso">Anticipo Otorgado</option>
                  <option value="otros_egresos">Otros Egresos</option>
                </>
              )}
            </select>
          </div>
          
          <div className="tx-form-group full-width">
            <label className="tx-label">Entidad o Responsable</label>
            <input 
              type="text" 
              className="tx-input" 
              placeholder="Buscar cliente, proveedor, o nombre..."
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
            />
          </div>
        </div>

        {/* 2. Datos Financieros */}
        <div className="divider" style={{ margin: 0 }}></div>
        
        <div className="tx-form-grid">
          <div className="tx-form-group full-width">
            <label className="tx-label">Monto ($)</label>
            <div className="tx-amount-wrapper">
              <span className="tx-amount-symbol">$</span>
              <input 
                type="number" 
                className="tx-amount-input" 
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <div className="tx-form-group">
            <label className="tx-label">Medio de Pago</label>
            <select className="tx-select" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia Bancaria</option>
              <option value="cheque">Cheque</option>
              <option value="cuenta_corriente">Cuenta Corriente</option>
            </select>
          </div>
          
          <div className="tx-form-group">
            <label className="tx-label">N° Referencia/Ticket</label>
            <input 
              type="text" 
              className="tx-input" 
              placeholder="Ej: TR-49281"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
        </div>

        {/* 3. Detalle Operativo */}
        <div className="divider" style={{ margin: 0 }}></div>

        <div className="tx-form-grid">
          <div className="tx-form-group full-width">
            <label className="tx-label">Concepto y Observaciones</label>
            <textarea 
              className="tx-textarea" 
              placeholder="Detalles adicionales del movimiento..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {type === 'expense' && (
            <div className="tx-form-group full-width">
              <label className="tx-label">Centro de Costo</label>
              <select className="tx-select" value={costCenter} onChange={(e) => setCostCenter(e.target.value)}>
                <option value="">-- Sin asignar --</option>
                <option value="logistica">Logística y Flota</option>
                <option value="admin">Administración</option>
                <option value="ventas">Ventas y Marketing</option>
                <option value="deposito">Depósito e Infraestructura</option>
              </select>
            </div>
          )}

          <TransactionDropzone />
        </div>

        {/* 4. Footer Productividad */}
        <div className="tx-modal-actions">
          <button type="button" className="tx-btn tx-btn--outline" onClick={onClose}>
            Cancelar
          </button>
          <button 
            type="button" 
            className="tx-btn tx-btn--secondary" 
            onClick={() => handleSave(true)}
            disabled={!isFormValid}
          >
            Guardar y Cargar Otro
          </button>
          <button 
            type="button" 
            className="tx-btn tx-btn--primary" 
            onClick={() => handleSave(false)}
            disabled={!isFormValid}
          >
            Guardar y Cerrar
          </button>
        </div>

      </div>
    </Modal>
  );
};
