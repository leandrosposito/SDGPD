import { type FC } from 'react';

// ============================================================
// OrderClientSection — Client & Commercial Information
// ============================================================

interface OrderClientSectionProps {
  client: string;
  onClientChange: (c: string) => void;
  seller: string;
  onSellerChange: (s: string) => void;
  paymentMethod: string;
  onPaymentMethodChange: (pm: string) => void;
  priceList: string;
  onPriceListChange: (pl: string) => void;
  // Mock alert states
  hasDebtAlert: boolean;
}

export const OrderClientSection: FC<OrderClientSectionProps> = ({
  client,
  onClientChange,
  seller,
  onSellerChange,
  paymentMethod,
  onPaymentMethodChange,
  priceList,
  onPriceListChange,
  hasDebtAlert,
}) => {
  return (
    <section className="co-section">
      <h3 className="co-section__title">1. Datos del Cliente y Comercial</h3>
      <div className="co-grid">
        <div className="co-form-group co-form-group--span-2">
          <label className="co-label">Cliente</label>
          <input
            type="text"
            className="co-input"
            placeholder="Buscar por razon social o CUIT..."
            value={client}
            onChange={(e) => onClientChange(e.target.value)}
          />
        </div>
        <div className="co-form-group">
          <label className="co-label">Vendedor</label>
          <select className="co-input" value={seller} onChange={(e) => onSellerChange(e.target.value)}>
            <option value="">Seleccionar...</option>
            <option value="Gonzalez, Maria">Gonzalez, Maria</option>
            <option value="Ramirez, Carlos">Ramirez, Carlos</option>
            <option value="Lopez, Beatriz">Lopez, Beatriz</option>
          </select>
        </div>
        <div className="co-form-group">
          <label className="co-label">Forma de Pago</label>
          <select className="co-input" value={paymentMethod} onChange={(e) => onPaymentMethodChange(e.target.value)}>
            <option value="">Seleccionar...</option>
            <option value="Cuenta Corriente">Cuenta Corriente</option>
            <option value="Contado">Contado</option>
            <option value="Efectivo">Efectivo</option>
            <option value="Transferencia">Transferencia</option>
            <option value="Cheque">Cheque</option>
          </select>
        </div>
        <div className="co-form-group">
          <label className="co-label">Lista de Precios</label>
          <select className="co-input" value={priceList} onChange={(e) => onPriceListChange(e.target.value)}>
            <option value="Mayorista">Mayorista</option>
            <option value="Distribuidor">Distribuidor</option>
            <option value="Especial">Especial</option>
          </select>
        </div>
      </div>

      {hasDebtAlert && (
        <div className="co-alert co-alert--danger">
          <svg className="co-alert__icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="co-alert__content">
            <p className="co-alert__title">Cliente Excedido</p>
            <p className="co-alert__desc">El saldo actual del cliente supera el limite de credito permitido. Requiere autorizacion de gerencia para facturar.</p>
          </div>
        </div>
      )}
    </section>
  );
};
