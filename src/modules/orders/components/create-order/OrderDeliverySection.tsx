import { type FC } from 'react';

// ============================================================
// OrderDeliverySection — Delivery info and observations
// ============================================================

interface OrderDeliverySectionProps {
  address: string;
  onAddressChange: (s: string) => void;
  locality: string;
  onLocalityChange: (s: string) => void;
  contact: string;
  onContactChange: (s: string) => void;
  phone: string;
  onPhoneChange: (s: string) => void;
  notes: string;
  onNotesChange: (s: string) => void;
}

export const OrderDeliverySection: FC<OrderDeliverySectionProps> = ({
  address,
  onAddressChange,
  locality,
  onLocalityChange,
  contact,
  onContactChange,
  phone,
  onPhoneChange,
  notes,
  onNotesChange,
}) => {
  return (
    <>
      <section className="co-section">
        <h3 className="co-section__title">5. Informacion de Entrega</h3>
        <div className="co-grid">
          <div className="co-form-group co-form-group--span-2">
            <label className="co-label">Direccion de Entrega</label>
            <input
              type="text"
              className="co-input"
              placeholder="Calle, Numero, Piso, Depto..."
              value={address}
              onChange={(e) => onAddressChange(e.target.value)}
            />
          </div>
          <div className="co-form-group">
            <label className="co-label">Localidad / Zona</label>
            <input
              type="text"
              className="co-input"
              value={locality}
              onChange={(e) => onLocalityChange(e.target.value)}
            />
          </div>
          <div className="co-form-group">
            <label className="co-label">Contacto (Receptor)</label>
            <input
              type="text"
              className="co-input"
              placeholder="Nombre del receptor..."
              value={contact}
              onChange={(e) => onContactChange(e.target.value)}
            />
          </div>
          <div className="co-form-group">
            <label className="co-label">Telefono</label>
            <input
              type="text"
              className="co-input"
              placeholder="Ej: 11 1234-5678"
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="co-section">
        <h3 className="co-section__title">6. Observaciones</h3>
        <div className="co-form-group">
          <textarea
            className="co-input co-input--textarea"
            placeholder="Notas internas, indicaciones para el repartidor, etc..."
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={4}
          />
        </div>
      </section>
    </>
  );
};
