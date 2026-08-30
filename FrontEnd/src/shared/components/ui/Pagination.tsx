import type { FC } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './Pagination.css';

// ============================================================
// Pagination — Control de paginacion generico para listados
// ============================================================

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  totalItems: number;
}

export const Pagination: FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  totalItems,
}) => {
  const rangeStart = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="pagination" role="navigation" aria-label="Paginacion">
      <span className="pagination__summary" aria-live="polite">
        Mostrando {rangeStart}-{rangeEnd} de {totalItems}
      </span>

      <div className="pagination__controls">
        <button
          type="button"
          className="pagination__btn"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Pagina anterior"
        >
          <ChevronLeft size={16} />
        </button>

        <span className="pagination__page">
          Pagina {currentPage} de {totalPages}
        </span>

        <button
          type="button"
          className="pagination__btn"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Pagina siguiente"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};
