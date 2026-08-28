import type { FC, ChangeEvent } from 'react';
import './ProductSearchBar.css';

interface ProductSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const ProductSearchBar: FC<ProductSearchBarProps> = ({ searchQuery, onSearchChange }) => {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value);
  };

  return (
    <div className="product-search-bar">
      <div className="product-search-bar__input-wrapper">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="product-search-bar__icon"
        >
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          type="text"
          className="product-search-bar__input"
          placeholder="Buscar por SKU, código de barras, nombre o descripción..."
          value={searchQuery}
          onChange={handleChange}
        />
      </div>
    </div>
  );
};
