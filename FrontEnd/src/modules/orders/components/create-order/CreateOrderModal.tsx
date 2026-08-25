import { type FC, useState, useMemo, useEffect } from 'react';
import { Modal } from '../../../../shared/components/ui/Modal';
import { OrderClientSection } from './OrderClientSection';
import { OrderDatesSection } from './OrderDatesSection';
import { OrderProductsSection, type OrderProductItem } from './OrderProductsSection';
import { OrderDeliverySection } from './OrderDeliverySection';
import { OrderTotalsSection } from './OrderTotalsSection';
import './CreateOrder.css';

// ============================================================
// CreateOrderModal — Unified full-screen order creation
// ============================================================

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateOrderModal: FC<CreateOrderModalProps> = ({ isOpen, onClose }) => {
  // Client Section State
  const [client, setClient] = useState('');
  const [seller, setSeller] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [priceList, setPriceList] = useState('Mayorista');
  const [hasDebtAlert, setHasDebtAlert] = useState(false);

  // Trigger mock debt alert if a specific client is typed
  useEffect(() => {
    if (client.toLowerCase().includes('excedido') || client.toLowerCase().includes('deuda')) {
      setHasDebtAlert(true);
    } else {
      setHasDebtAlert(false);
    }
  }, [client]);

  // Dates Section State
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [initialStatus, setInitialStatus] = useState('pending');

  // Products Section State
  const [items, setItems] = useState<OrderProductItem[]>([]);

  // Delivery & Notes State
  const [address, setAddress] = useState('');
  const [locality, setLocality] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Totals Computation
  const subtotal = useMemo(() => items.reduce((acc, item) => acc + (item.price * item.quantity), 0), [items]);
  const discount = useMemo(() => items.reduce((acc, item) => acc + (item.discount * item.quantity), 0), [items]);

  const handleClose = () => {
    // Reset state on close
    setClient('');
    setSeller('');
    setPaymentMethod('');
    setPriceList('Mayorista');
    setOrderDate(new Date().toISOString().split('T')[0]);
    setDeliveryDate('');
    setInitialStatus('pending');
    setItems([]);
    setAddress('');
    setLocality('');
    setContact('');
    setPhone('');
    setNotes('');
    onClose();
  };

  const handleConfirm = () => {
    // Mock save logic
    alert('Pedido guardado con exito!');
    handleClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Nuevo Pedido" size="xl">
      <div className="create-order">
        <OrderClientSection
          client={client}
          onClientChange={setClient}
          seller={seller}
          onSellerChange={setSeller}
          paymentMethod={paymentMethod}
          onPaymentMethodChange={setPaymentMethod}
          priceList={priceList}
          onPriceListChange={setPriceList}
          hasDebtAlert={hasDebtAlert}
        />

        <OrderDatesSection
          orderDate={orderDate}
          onOrderDateChange={setOrderDate}
          deliveryDate={deliveryDate}
          onDeliveryDateChange={setDeliveryDate}
          initialStatus={initialStatus}
          onInitialStatusChange={setInitialStatus}
        />

        <OrderProductsSection
          items={items}
          onItemsChange={setItems}
          priceList={priceList}
        />

        <OrderTotalsSection
          subtotal={subtotal}
          discount={discount}
          taxRate={0.21}
        />

        <OrderDeliverySection
          address={address}
          onAddressChange={setAddress}
          locality={locality}
          onLocalityChange={setLocality}
          contact={contact}
          onContactChange={setContact}
          phone={phone}
          onPhoneChange={setPhone}
          notes={notes}
          onNotesChange={setNotes}
        />

        {/* Section 7: Final Actions Footer */}
        <div className="co-footer">
          <button className="co-btn co-btn--ghost" onClick={handleClose}>
            Cancelar
          </button>
          <div className="co-footer__actions">
            <button className="co-btn co-btn--outline" onClick={handleClose}>
              Guardar Borrador
            </button>
            <button className="co-btn co-btn--primary" onClick={handleConfirm} disabled={items.length === 0}>
              Confirmar Pedido
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
