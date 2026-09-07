import { useMemo, useState, type FC } from 'react';
import type { ClientAccount } from '@/shared/types/client.types';

// ============================================================
// OrderClientSection — Client & Commercial Information
//
// Cliente: combobox de busqueda contra un catalogo ya cargado en
// memoria (Tanda 5, AUDIT_4_IDS_RELACIONES.md hallazgo ALTO #1) — mismo
// patron que el buscador de producto de PurchaseOrderFormModal.tsx
// (texto libre que filtra products/suppliers en memoria, lista de
// resultados acotada, click para elegir). Ya no es un <input> de texto
// libre sin relacion real: eligiendo un ClientAccount se completa
// clientId + el snapshot (nombre/direccion/zona) a partir del cliente
// real, no de lo que el usuario tipeo.
// ============================================================

const CLIENT_MATCH_LIMIT = 8;

interface OrderClientSectionProps {
  clients: ClientAccount[];
  selectedClient: ClientAccount | null;
  onSelectClient: (client: ClientAccount) => void;
  onClearClient: () => void;
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
  clients,
  selectedClient,
  onSelectClient,
  onClearClient,
  seller,
  onSellerChange,
  paymentMethod,
  onPaymentMethodChange,
  priceList,
  onPriceListChange,
  hasDebtAlert,
}) => {
  const [clientQuery, setClientQuery] = useState('');

  const clientMatches = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return [];
    return clients
      .filter((c) => c.clientName.toLowerCase().includes(q) || c.cuit.toLowerCase().includes(q))
      .slice(0, CLIENT_MATCH_LIMIT);
  }, [clients, clientQuery]);

  function handleSelectClient(client: ClientAccount) {
    onSelectClient(client);
    setClientQuery('');
  }

  return (
    <section className="co-section">
      <h3 className="co-section__title">1. Datos del Cliente y Comercial</h3>
      <div className="co-grid">
        <div className="co-form-group co-form-group--span-2" style={{ position: 'relative' }}>
          <label className="co-label" htmlFor="co-client-search">Cliente</label>
          {selectedClient ? (
            <div className="co-input co-client-selected">
              <span className="co-client-selected__name">{selectedClient.clientName}</span>
              <span className="co-client-selected__cuit">{selectedClient.cuit}</span>
              <button type="button" className="co-client-selected__change" onClick={onClearClient}>
                Cambiar
              </button>
            </div>
          ) : (
            <input
              id="co-client-search"
              type="text"
              className="co-input"
              placeholder="Buscar por razon social o CUIT..."
              value={clientQuery}
              onChange={(e) => setClientQuery(e.target.value)}
            />
          )}
          {!selectedClient && clientMatches.length > 0 && (
            <ul className="co-client-matches" role="listbox" aria-label="Resultados de busqueda de clientes">
              {clientMatches.map((c) => (
                <li key={c.id}>
                  <button type="button" className="co-client-matches__item" onClick={() => handleSelectClient(c)}>
                    <span className="co-client-matches__name">{c.clientName}</span>
                    <span className="co-client-matches__cuit">{c.cuit}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
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
