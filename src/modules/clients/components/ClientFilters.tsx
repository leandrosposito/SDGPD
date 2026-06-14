import { type FC } from 'react';

interface ClientFiltersProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  zone: string;
  onZoneChange: (val: string) => void;
  seller: string;
  onSellerChange: (val: string) => void;
  status: string;
  onStatusChange: (val: string) => void;
}

export const ClientFilters: FC<ClientFiltersProps> = ({
  searchQuery, onSearchChange,
  zone, onZoneChange,
  seller, onSellerChange,
  status, onStatusChange
}) => {
  return (
    <div className="client-filters">
      <div className="client-filters__search">
        <svg className="client-filters__icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
          <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <input 
          type="text" 
          className="client-filters__input client-filters__input--search"
          placeholder="Buscar por Razon Social o CUIT..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <div className="client-filters__grid">
        <select className="client-filters__select" value={zone} onChange={(e) => onZoneChange(e.target.value)}>
          <option value="">Todas las Zonas</option>
          <option value="Norte">Norte</option>
          <option value="Sur">Sur</option>
          <option value="Centro">Centro</option>
        </select>
        <select className="client-filters__select" value={seller} onChange={(e) => onSellerChange(e.target.value)}>
          <option value="">Todos los Vendedores</option>
          <option value="Gonzalez, Maria">Gonzalez, Maria</option>
          <option value="Ramirez, Carlos">Ramirez, Carlos</option>
        </select>
        <select className="client-filters__select" value={status} onChange={(e) => onStatusChange(e.target.value)}>
          <option value="">Todos los Estados</option>
          <option value="Al dia">Al dia</option>
          <option value="Con Deuda">Con Deuda</option>
        </select>
      </div>
    </div>
  );
};
