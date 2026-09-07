import { type FC, useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/shared/components/ui/Modal';
import { useCachedQuery, CACHE_STALE_TIME } from '@/shared/hooks/useCachedQuery';
import { useSessionStore } from '@/shared/state/useSessionStore';
import type { InventoryItem } from '@/shared/types/inventory.types';
import type { Order } from '@/shared/types/order.types';
import type { ClientAccount } from '@/shared/types/client.types';
import { fetchProducts } from '@/shared/api/products/products.service';
import { fetchClientsCatalog } from '@/modules/clients/api/clients.service';
import { createOrder, type OrderFormInput } from '@/modules/orders/api/orders.service';
import { todayLocalDateString } from '@/shared/utils/date';

// Referencia estable: ver mismo patron en ComprasPage/InventoryPage.
const EMPTY_PRODUCTS: InventoryItem[] = [];
const EMPTY_CLIENTS: ClientAccount[] = [];
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
  const empresaId = useSessionStore((s) => s.session?.company.id);
  const [isSaving, setIsSaving] = useState(false);

  // Products available to add to the order (RF-PRD-001 master data).
  // Tanda 2.5, useCachedQuery: mismo queryName 'products' que
  // InventoryPage/ComprasPage — 3er consumidor del mismo catalogo,
  // ahora deduplicado en vez de un 3er fetch independiente (ver
  // RELEVAMIENTO_CACHE.md, C1).
  const { data: productsData, error: productsError } = useCachedQuery(
    'products',
    undefined,
    (signal) => fetchProducts(empresaId ?? '', signal),
    { staleTime: CACHE_STALE_TIME.CATALOG }
  );
  const products = productsData ?? EMPTY_PRODUCTS;

  useEffect(() => {
    if (productsError) toast.error('No se pudo cargar el listado de productos.');
  }, [productsError]);

  // Clientes reales disponibles para elegir (Tanda 5,
  // AUDIT_4_IDS_RELACIONES.md hallazgo ALTO #1) — mismo criterio de
  // catalogo completo sin paginar que products (combobox, no listado).
  const { data: clientsData, error: clientsError } = useCachedQuery(
    'clients-catalog',
    undefined,
    (signal) => fetchClientsCatalog(empresaId ?? '', signal),
    { staleTime: CACHE_STALE_TIME.CATALOG }
  );
  const clients = clientsData ?? EMPTY_CLIENTS;

  useEffect(() => {
    if (clientsError) toast.error('No se pudo cargar el listado de clientes.');
  }, [clientsError]);

  // Client Section State — selectedClient es la relacion tipada real
  // (Order.clientId), no texto libre (Tanda 5).
  const [selectedClient, setSelectedClient] = useState<ClientAccount | null>(null);
  const [seller, setSeller] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [priceList, setPriceList] = useState('Mayorista');

  // Alerta de deuda derivada del cliente REAL elegido (antes era un
  // match de texto contra lo que el usuario tipeaba, sin relacion con
  // ningun dato real) — currentBalance/creditLimit ya existen en
  // ClientAccount (client.types.ts).
  const hasDebtAlert = selectedClient ? selectedClient.currentBalance > selectedClient.creditLimit : false;

  // Dates Section State
  const [orderDate, setOrderDate] = useState(todayLocalDateString());
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
    setSelectedClient(null);
    setSeller('');
    setPaymentMethod('');
    setPriceList('Mayorista');
    setOrderDate(todayLocalDateString());
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

  // Tanda 3a: el pedido se crea contra orders.service.ts (httpClient +
  // store en memoria del service) en vez de armarse a mano acá con un
  // id/fecha falsos — el service genera esos campos, igual que
  // suppliers.service.ts#createSupplier. `onConfirm` recibe el Order
  // real devuelto por el service, no un objeto construido en el
  // cliente.
  const handleConfirm = async () => {
    if (!empresaId) {
      toast.error('Todavia no hay una sesion activa.');
      return;
    }

    if (!selectedClient) {
      toast.error('Elegi un cliente antes de confirmar el pedido.');
      return;
    }

    const tax = (subtotal - discount) * 0.21;
    const totalAmount = subtotal - discount + tax;

    const input: OrderFormInput = {
      clientId: selectedClient.id,
      clientName: selectedClient.clientName,
      clientAddress: selectedClient.address,
      clientZone: selectedClient.zone,
      sellerName: seller,
      paymentMethod: paymentMethod as Order['paymentMethod'],
      subtotal,
      discount,
      tax,
      totalAmount,
      notes,
      items: items.map((item) => ({
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        subtotal: item.subtotal,
      })),
    };

    setIsSaving(true);
    try {
      const created = await createOrder(empresaId, input);
      onConfirm?.(created);
      toast.success('Pedido guardado con exito!');
      handleClose();
    } catch {
      toast.error('No se pudo guardar el pedido.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Nuevo Pedido" size="xl">
      <div className="create-order">
        <OrderClientSection
          clients={clients}
          selectedClient={selectedClient}
          onSelectClient={setSelectedClient}
          onClearClient={() => setSelectedClient(null)}
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
            <button
              className="co-btn co-btn--primary"
              onClick={handleConfirm}
              disabled={items.length === 0 || !selectedClient || isSaving}
            >
              {isSaving ? 'Guardando...' : 'Confirmar Pedido'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
