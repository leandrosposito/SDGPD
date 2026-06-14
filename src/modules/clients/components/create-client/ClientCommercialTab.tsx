import { type FC } from 'react';

interface ClientCommercialTabProps {
  listaPrecios: string;
  setListaPrecios: (val: string) => void;
  condicionVenta: string;
  setCondicionVenta: (val: string) => void;
  limiteCredito: number;
  setLimiteCredito: (val: number) => void;
  vendedor: string;
  setVendedor: (val: string) => void;
}

export const ClientCommercialTab: FC<ClientCommercialTabProps> = ({
  listaPrecios, setListaPrecios,
  condicionVenta, setCondicionVenta,
  limiteCredito, setLimiteCredito,
  vendedor, setVendedor
}) => {
  return (
    <div className="client-form-grid">
      <div className="client-form-group">
        <label className="client-form-label">Lista de Precios</label>
        <select 
          className="client-form-select"
          value={listaPrecios}
          onChange={(e) => setListaPrecios(e.target.value)}
        >
          <option value="Mayorista">Mayorista</option>
          <option value="Distribuidor">Distribuidor</option>
          <option value="Minorista">Minorista</option>
        </select>
      </div>

      <div className="client-form-group">
        <label className="client-form-label">Condicion de Venta</label>
        <select 
          className="client-form-select"
          value={condicionVenta}
          onChange={(e) => setCondicionVenta(e.target.value)}
        >
          <option value="Contado">Contado</option>
          <option value="Cuenta Corriente">Cuenta Corriente</option>
          <option value="Cheque">Cheque</option>
        </select>
      </div>

      <div className="client-form-group">
        <label className="client-form-label">Limite de Credito ($)</label>
        <input 
          type="number" 
          className="client-form-input text-right"
          placeholder="0.00"
          value={limiteCredito}
          onChange={(e) => setLimiteCredito(Number(e.target.value))}
        />
      </div>

      <div className="client-form-group">
        <label className="client-form-label">Vendedor Asignado</label>
        <select 
          className="client-form-select"
          value={vendedor}
          onChange={(e) => setVendedor(e.target.value)}
        >
          <option value="Gonzalez, Maria">Gonzalez, Maria</option>
          <option value="Ramirez, Carlos">Ramirez, Carlos</option>
          <option value="Sin Asignar">Sin Asignar</option>
        </select>
      </div>
    </div>
  );
};
