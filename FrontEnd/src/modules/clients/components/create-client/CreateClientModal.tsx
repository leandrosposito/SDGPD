import { useEffect, useState, type FC } from 'react';
import { toast } from 'sonner';
import { Modal } from '../../../../shared/components/ui/Modal';
import type { ClientAccount } from '../../../../shared/types/client.types';
import type { ClientFormInput } from '../../../../services/mock/clients.service';
import { ClientGeneralTab } from './ClientGeneralTab';
import { ClientLogisticsTab } from './ClientLogisticsTab';
import { ClientCommercialTab } from './ClientCommercialTab';
import { ClientSettingsTab } from './ClientSettingsTab';
import './CreateClient.css';

interface CreateClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  client?: ClientAccount | null;
  onSave?: (input: ClientFormInput, clientId?: string) => Promise<ClientAccount>;
}

type TabType = 'general' | 'logistica' | 'comercial' | 'ajustes';

export const CreateClientModal: FC<CreateClientModalProps> = ({ isOpen, onClose, client, onSave }) => {
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [showErrors, setShowErrors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [cuit, setCuit] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [nombreFantasia, setNombreFantasia] = useState('');
  const [condicionIva, setCondicionIva] = useState('Responsable Inscripto');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');

  const [direccionFiscal, setDireccionFiscal] = useState('');
  const [zona, setZona] = useState('Norte');
  const [googleMapsLink, setGoogleMapsLink] = useState('');
  const [isEntregaIgualFiscal, setIsEntregaIgualFiscal] = useState(true);
  const [direccionEntrega, setDireccionEntrega] = useState('');
  const [referenciasEntrega, setReferenciasEntrega] = useState('');

  const [listaPrecios, setListaPrecios] = useState('Mayorista');
  const [condicionVenta, setCondicionVenta] = useState('Contado');
  const [limiteCredito, setLimiteCredito] = useState(0);
  const [vendedor, setVendedor] = useState('Gonzalez, Maria');

  const [categoria, setCategoria] = useState('Kiosco');
  const [notas, setNotas] = useState('');
  const [isActive, setIsActive] = useState(true);

  const resetForm = () => {
    setActiveTab('general');
    setShowErrors(false);
    setCuit(''); setRazonSocial(''); setNombreFantasia(''); setCondicionIva('Responsable Inscripto');
    setTelefono(''); setEmail(''); setDireccionFiscal(''); setZona('Norte'); setGoogleMapsLink('');
    setIsEntregaIgualFiscal(true); setDireccionEntrega(''); setReferenciasEntrega('');
    setListaPrecios('Mayorista'); setCondicionVenta('Contado'); setLimiteCredito(0); setVendedor('Gonzalez, Maria');
    setCategoria('Kiosco'); setNotas(''); setIsActive(true);
  };

  // Precarga los campos que persiste ClientAccount al abrir el modal en modo edicion.
  useEffect(() => {
    if (isOpen) {
      if (client) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setActiveTab('general');
        setShowErrors(false);
        setCuit(client.cuit);
        setRazonSocial(client.clientName);
        setTelefono(client.phone);
        setDireccionFiscal(client.address);
        setZona(client.zone);
        setVendedor(client.sellerName);
        setLimiteCredito(client.creditLimit);
      } else {
        resetForm();
      }
    }
  }, [isOpen, client]);

  const validateAndClose = () => {
    if (!cuit || !razonSocial || cuit === '30-11111111-1') {
      setShowErrors(true);
      setActiveTab('general');
      return false;
    }
    return true;
  };

  const buildClientInput = (): ClientFormInput => ({
    clientName: razonSocial,
    cuit,
    address: direccionFiscal,
    phone: telefono,
    zone: zona,
    sellerName: vendedor,
    creditLimit: limiteCredito,
  });

  const handleSave = async () => {
    if (!validateAndClose()) return;
    if (!onSave) {
      onClose();
      resetForm();
      return;
    }
    setIsSubmitting(true);
    try {
      await onSave(buildClientInput(), client?.id);
      toast.success(client ? 'Cliente actualizado correctamente.' : 'Cliente creado correctamente.');
      onClose();
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar el cliente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveAndOrder = async () => {
    if (!validateAndClose()) return;
    if (!onSave) {
      onClose();
      resetForm();
      toast.success('Simulando apertura del Nuevo Pedido para el cliente recién creado.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onSave(buildClientInput(), client?.id);
      onClose();
      resetForm();
      toast.success('Cliente guardado. Simulando apertura del Nuevo Pedido...');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar el cliente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const footer = (
    <div className="client-modal-footer">
      <button className="client-modal-btn client-modal-btn--outline" onClick={handleClose} disabled={isSubmitting}>
        Cancelar
      </button>
      <button className="client-modal-btn client-modal-btn--primary" onClick={handleSave} disabled={isSubmitting}>
        {isSubmitting ? 'Guardando...' : 'Guardar'}
      </button>
      <button className="client-modal-btn client-modal-btn--special" onClick={handleSaveAndOrder} disabled={isSubmitting}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Guardar y Nuevo Pedido
      </button>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={client ? 'Editar Cliente' : 'Nuevo Cliente'} size="xl" footer={footer}>
      <div className="client-tabs" style={{ marginTop: 0, marginBottom: '1.5rem' }}>
        <button 
          className={`client-tab ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          Informacion General
        </button>
        <button 
          className={`client-tab ${activeTab === 'logistica' ? 'active' : ''}`}
          onClick={() => setActiveTab('logistica')}
        >
          Logistica y Ubicacion
        </button>
        <button 
          className={`client-tab ${activeTab === 'comercial' ? 'active' : ''}`}
          onClick={() => setActiveTab('comercial')}
        >
          Configuracion Comercial
        </button>
        <button 
          className={`client-tab ${activeTab === 'ajustes' ? 'active' : ''}`}
          onClick={() => setActiveTab('ajustes')}
        >
          Segmentacion y Notas
        </button>
      </div>

      <div className="create-client-content">
        {activeTab === 'general' && (
          <ClientGeneralTab 
            cuit={cuit} setCuit={setCuit}
            razonSocial={razonSocial} setRazonSocial={setRazonSocial}
            nombreFantasia={nombreFantasia} setNombreFantasia={setNombreFantasia}
            condicionIva={condicionIva} setCondicionIva={setCondicionIva}
            telefono={telefono} setTelefono={setTelefono}
            email={email} setEmail={setEmail}
            showErrors={showErrors}
          />
        )}
        {activeTab === 'logistica' && (
          <ClientLogisticsTab 
            direccionFiscal={direccionFiscal} setDireccionFiscal={setDireccionFiscal}
            zona={zona} setZona={setZona}
            googleMapsLink={googleMapsLink} setGoogleMapsLink={setGoogleMapsLink}
            isEntregaIgualFiscal={isEntregaIgualFiscal} setIsEntregaIgualFiscal={setIsEntregaIgualFiscal}
            direccionEntrega={direccionEntrega} setDireccionEntrega={setDireccionEntrega}
            referenciasEntrega={referenciasEntrega} setReferenciasEntrega={setReferenciasEntrega}
          />
        )}
        {activeTab === 'comercial' && (
          <ClientCommercialTab 
            listaPrecios={listaPrecios} setListaPrecios={setListaPrecios}
            condicionVenta={condicionVenta} setCondicionVenta={setCondicionVenta}
            limiteCredito={limiteCredito} setLimiteCredito={setLimiteCredito}
            vendedor={vendedor} setVendedor={setVendedor}
          />
        )}
        {activeTab === 'ajustes' && (
          <ClientSettingsTab 
            categoria={categoria} setCategoria={setCategoria}
            notas={notas} setNotas={setNotas}
            isActive={isActive} setIsActive={setIsActive}
          />
        )}
      </div>
    </Modal>
  );
};
