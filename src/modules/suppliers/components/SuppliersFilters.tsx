import { type FC } from 'react';

interface SuppliersFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
}

export const SuppliersFilters: FC<SuppliersFiltersProps> = ({
  searchTerm,
  onSearchChange,
  selectedCategory,
  onCategoryChange
}) => {
  return (
    <div className="suppliers-filters">
      <div className="suppliers-filters__search">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg" className="suppliers-filters__search-icon">
          <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <input 
          type="text" 
          className="suppliers-filters__input suppliers-filters__input--search"
          placeholder="Buscar por razon social o CUIT..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="suppliers-filters__group">
        <select 
          className="suppliers-filters__input"
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
        >
          <option value="">Todos los Rubros</option>
          <option value="Alimentos Secos">Alimentos Secos</option>
          <option value="Infusiones">Infusiones</option>
          <option value="Golosinas">Golosinas</option>
          <option value="Limpieza">Limpieza</option>
          <option value="Bebidas">Bebidas</option>
        </select>
      </div>
    </div>
  );
};
