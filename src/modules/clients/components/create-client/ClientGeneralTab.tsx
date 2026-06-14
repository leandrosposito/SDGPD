import { type FC, useState, useEffect } from 'react';

interface ClientGeneralTabProps {
  cuit: string;
  setCuit: (val: string) => void;
  razonSocial: string;
  setRazonSocial: (val: string) => void;
  nombreFantasia: string;
  setNombreFantasia: (val: string) => void;
  condicionIva: string;
  setCondicionIva: (val: string) => void;
  telefono: string;
  setTelefono: (val: string) => void;
  email: string;
  setEmail: (val: string) => void;
  showErrors: boolean;
}

export const ClientGeneralTab: FC<ClientGeneralTabProps> = ({
  cuit, setCuit,
  razonSocial, setRazonSocial,
  nombreFantasia, setNombreFantasia,
  condicionIva, setCondicionIva,
  telefono, setTelefono,
  email, setEmail,
  showErrors
}) => {
  const [isSearchingAfip, setIsSearchingAfip] = useState(false);
  const [duplicateError, setDuplicateError] = useState(false);

  // AFIP Mock Logic
  useEffect(() => {
    if (cuit.length >= 11) {
      if (cuit === '30-11111111-1') {
        setDuplicateError(true);
        setRazonSocial('');
        setIsSearchingAfip(false);
      } else {
        setDuplicateError(false);
        setIsSearchingAfip(true);
        // Simulate AFIP network request
        const timer = setTimeout(() => {
          setRazonSocial('Distribuidora del Centro S.A.');
          setIsSearchingAfip(false);
        }, 1500);
        return () => clearTimeout(timer);
      }
    } else {
      setDuplicateError(false);
      setIsSearchingAfip(false);
    }
  }, [cuit, setRazonSocial]);

  return (
    <div className="client-form-grid">
      <div className="client-form-group">
        <label className="client-form-label">
          CUIT <span className="text-danger">*</span>
        </label>
        <input 
          type="text" 
          className={`client-form-input ${showErrors && !cuit ? 'client-form-input--error' : ''} ${duplicateError ? 'client-form-input--error' : ''}`}
          placeholder="Ej: 30-71234567-8"
          value={cuit}
          onChange={(e) => setCuit(e.target.value)}
        />
        {isSearchingAfip && (
          <div className="client-form-hint text-tertiary flex items-center gap-2 mt-1">
            <svg className="animate-spin" viewBox="0 0 24 24" width="14" height="14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Buscando en AFIP...
          </div>
        )}
        {duplicateError && (
          <div className="client-form-hint text-danger flex items-center gap-1 mt-1 font-medium">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 8v4m0 4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Cuidado: Ya existe un cliente con este CUIT.
          </div>
        )}
      </div>

      <div className="client-form-group">
        <label className="client-form-label">Razon Social <span className="text-danger">*</span></label>
        <input 
          type="text" 
          className={`client-form-input ${showErrors && !razonSocial ? 'client-form-input--error' : ''}`}
          placeholder="Autocompletado por AFIP"
          value={razonSocial}
          onChange={(e) => setRazonSocial(e.target.value)}
        />
      </div>

      <div className="client-form-group">
        <label className="client-form-label">Nombre de Fantasia</label>
        <input 
          type="text" 
          className="client-form-input"
          placeholder="Ej: Kiosco El Paso"
          value={nombreFantasia}
          onChange={(e) => setNombreFantasia(e.target.value)}
        />
      </div>

      <div className="client-form-group">
        <label className="client-form-label">Condicion ante el IVA</label>
        <select 
          className="client-form-select"
          value={condicionIva}
          onChange={(e) => setCondicionIva(e.target.value)}
        >
          <option value="Responsable Inscripto">Responsable Inscripto</option>
          <option value="Monotributo">Monotributo</option>
          <option value="Exento">Exento</option>
          <option value="Consumidor Final">Consumidor Final</option>
        </select>
      </div>

      <div className="client-form-group">
        <label className="client-form-label">Telefono</label>
        <input 
          type="text" 
          className="client-form-input"
          placeholder="Ej: 11 1234-5678"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
        />
      </div>

      <div className="client-form-group">
        <label className="client-form-label">Email</label>
        <input 
          type="email" 
          className="client-form-input"
          placeholder="correo@ejemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
    </div>
  );
};
