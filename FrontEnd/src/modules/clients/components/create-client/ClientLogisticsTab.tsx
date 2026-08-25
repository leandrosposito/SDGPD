import { type FC } from 'react';

interface ClientLogisticsTabProps {
  direccionFiscal: string;
  setDireccionFiscal: (val: string) => void;
  zona: string;
  setZona: (val: string) => void;
  googleMapsLink: string;
  setGoogleMapsLink: (val: string) => void;
  isEntregaIgualFiscal: boolean;
  setIsEntregaIgualFiscal: (val: boolean) => void;
  direccionEntrega: string;
  setDireccionEntrega: (val: string) => void;
  referenciasEntrega: string;
  setReferenciasEntrega: (val: string) => void;
}

export const ClientLogisticsTab: FC<ClientLogisticsTabProps> = ({
  direccionFiscal, setDireccionFiscal,
  zona, setZona,
  googleMapsLink, setGoogleMapsLink,
  isEntregaIgualFiscal, setIsEntregaIgualFiscal,
  direccionEntrega, setDireccionEntrega,
  referenciasEntrega, setReferenciasEntrega
}) => {
  return (
    <div className="client-form-col">
      <div className="client-form-grid">
        <div className="client-form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="client-form-label">Direccion Fiscal</label>
          <input 
            type="text" 
            className="client-form-input"
            placeholder="Calle, Numero, Localidad"
            value={direccionFiscal}
            onChange={(e) => setDireccionFiscal(e.target.value)}
          />
        </div>

        <div className="client-form-group">
          <label className="client-form-label">Zona de Reparto</label>
          <select 
            className="client-form-select"
            value={zona}
            onChange={(e) => setZona(e.target.value)}
          >
            <option value="Norte">Norte</option>
            <option value="Sur">Sur</option>
            <option value="Centro">Centro</option>
            <option value="Oeste">Oeste</option>
          </select>
        </div>

        <div className="client-form-group">
          <label className="client-form-label">Link de Google Maps (Opcional)</label>
          <input 
            type="text" 
            className="client-form-input"
            placeholder="https://maps.google.com/..."
            value={googleMapsLink}
            onChange={(e) => setGoogleMapsLink(e.target.value)}
          />
        </div>
      </div>

      <div className="divider" />

      <label className="client-form-checkbox-label">
        <input 
          type="checkbox" 
          className="client-form-checkbox"
          checked={isEntregaIgualFiscal}
          onChange={(e) => setIsEntregaIgualFiscal(e.target.checked)}
        />
        <span>La direccion de entrega es igual a la fiscal</span>
      </label>

      {!isEntregaIgualFiscal && (
        <div className="client-form-grid mt-4 page-enter">
          <div className="client-form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="client-form-label">Direccion de Entrega</label>
            <input 
              type="text" 
              className="client-form-input"
              placeholder="Calle, Numero, Localidad de entrega"
              value={direccionEntrega}
              onChange={(e) => setDireccionEntrega(e.target.value)}
            />
          </div>
          <div className="client-form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="client-form-label">Referencias para el Repartidor</label>
            <textarea 
              className="client-form-input client-form-input--textarea"
              placeholder="Entre calles, color de porton, horarios..."
              value={referenciasEntrega}
              onChange={(e) => setReferenciasEntrega(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
