import { type FC, useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/shared/components/ui/Modal';
import { useCachedQuery, CACHE_STALE_TIME } from '@/shared/hooks/useCachedQuery';
import type { InventoryItem } from '@/shared/types/inventory.types';
import type { Order } from '@/shared/types/order.types';
import { fetchProducts } from '@/services/mock/products.service';

// Referencia estable: ver mismo patron en ComprasPage/InventoryPage.
const EMPTY_PRODUCTS: InventoryItem[] = [];
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
  onConfirm?: (order: Order) => void;
}

export const CreateOrderModal: FC<CreateOrderModalProps> = ({ isOpen, onClose, onConfirm }) => {
  // Products available to add to the order (RF-PRD-001 master data).
  // Tanda 2.5, useCachedQuery: mismo queryName 'products' que
  // InventoryPage/ComprasPage — 3er consumidor del mismo catalogo,
  // ahora deduplicado en vez de un 3er fetch independiente (ver
  // RELEVAMIENTO_CACHE.md, C1).
  const { data: productsData, error: productsError } = useCachedQuery(
    'products',
    undefined,
    (signal) => fetchProducts(signal),
    { staleTime: CACHE_STALE_TIME.CATALOG }
  );
  const products = productsData ?? EMPTY_PRODUCTS;

  useEffect(() => {
    if (productsError) toast.error('No se pudo cargar el listado de productos.');
  }, [productsError]);

  // Client Section State
  const [client, setClient] = useState('');
  const [seller, setSeller] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [priceList, setPriceList] = useState('Mayorista');

  // Mock debt alert if a specific client is typed
  const hasDebtAlert = client.toLowerCase().includes('excedido') || client.toLowerCase().includes('deuda');

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
    const tax = (subtotal - discount) * 0.21;
    const totalAmount = subtotal - discount + tax;
    const now = new Date().toISOString();

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber: `PED-${Date.now().toString().slice(-5)}`,
      date: now,
      clientName: client,
      clientAddress: address,
      clientZone: locality,
      sellerName: seller,
      status: 'pending',
      source: 'manual',
      paymentMethod: paymentMethod as Order['paymentMethod'],
      subtotal,
      discount,
      tax,
      totalAmount,
      notes,
      items: items.map((item) => ({
        id: item.id,
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        subtotal: item.subtotal,
      })),
      history: [
        { id: `h-${Date.now()}`, date: now, status: 'pending', description: 'Pedido creado manualmente' },
      ],
    };

    onConfirm?.(newOrder);
    toast.success('Pedido guardado con exito!');
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
          products={products}
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
