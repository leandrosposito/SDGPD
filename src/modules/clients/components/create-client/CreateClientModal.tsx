import { useState, type FC } from 'react';
import { Modal } from '../../../../components/ui/Modal';
import { ClientGeneralTab } from './ClientGeneralTab';
import { ClientLogisticsTab } from './ClientLogisticsTab';
import { ClientCommercialTab } from './ClientCommercialTab';
import { ClientSettingsTab } from './ClientSettingsTab';
import './CreateClient.css';

interface CreateClientModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'general' | 'logistica' | 'comercial' | 'ajustes';

export const CreateClientModal: FC<CreateClientModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [showErrors, setShowErrors] = useState(false);

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

  const validateAndClose = () => {
    if (!cuit || !razonSocial || cuit === '30-11111111-1') {
      setShowErrors(true);
      setActiveTab('general');
      return false;
    }
    return true;
  };

  const handleSave = () => {
    if (validateAndClose()) {
      onClose();
      resetForm();
    }
  };


  const handleSaveAndOrder = () => {
    if (validateAndClose()) {
      onClose();
      resetForm();
      alert('Simulando apertura del Nuevo Pedido para el cliente recién creado.');
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const footer = (
    <div className="client-modal-footer">
      <button className="client-modal-btn client-modal-btn--outline" onClick={handleClose}>
        Cancelar
      </button>
      <button className="client-modal-btn client-modal-btn--primary" onClick={handleSave}>
        Guardar
      </button>
      <button className="client-modal-btn client-modal-btn--special" onClick={handleSaveAndOrder}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Guardar y Nuevo Pedido
      </button>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Nuevo Cliente" size="xl" footer={footer}>
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
