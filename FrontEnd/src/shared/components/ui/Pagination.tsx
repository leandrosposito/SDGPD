import { useState, type FC, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PAGE_SIZE_OPTIONS } from './paginationDefaults';
import './Pagination.css';

// ============================================================
// Pagination — Control de paginacion generico para listados server-side
// (P6, DECISIONES_TECNICAS.md). Anterior/siguiente ya no alcanza con
// datasets grandes (miles de paginas): suma salto directo a pagina y
// selector de tamaño de pagina.
// ============================================================

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  totalItems: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: readonly number[];
}

export const Pagination: FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  totalItems,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
}) => {
  const rangeStart = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, totalItems);

  // Input de salto de pagina: se resincroniza con `currentPage` cuando
  // cambia desde afuera (filtro, sucursal, etc.) comparando durante el
  // render — mismo patron ya usado en el proyecto para evitar un efecto
  // solo para reflejar una prop en un input controlado.
  const [pageInput, setPageInput] = useState(String(currentPage));
  const [trackedPage, setTrackedPage] = useState(currentPage);
  if (currentPage !== trackedPage) {
    setTrackedPage(currentPage);
    setPageInput(String(currentPage));
  }

  function handleJumpSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = Number(pageInput);
    if (!Number.isFinite(parsed)) {
      setPageInput(String(currentPage));
      return;
    }
    // onPageChange (setPage del hook) ya clampa a [1, totalPages].
    onPageChange(Math.trunc(parsed));
  }

  return (
    <div className="pagination" role="navigation" aria-label="Paginacion">
      <span className="pagination__summary" aria-live="polite">
        Mostrando {rangeStart}-{rangeEnd} de {totalItems}
      </span>

      <div className="pagination__controls">
        {onPageSizeChange && (
          <label className="pagination__size">
            <span className="pagination__size-label">Filas por pagina</span>
            <select
              className="pagination__size-select"
              aria-label="Filas por pagina"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}

        <button
          type="button"
          className="pagination__btn"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Pagina anterior"
        >
          <ChevronLeft size={16} />
        </button>

        <span className="pagination__page" aria-live="polite">
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

        <form className="pagination__jump" onSubmit={handleJumpSubmit}>
          <label className="pagination__jump-label" htmlFor="pagination-jump-input">
            Ir a la pagina
          </label>
          <input
            id="pagination-jump-input"
            type="number"
            className="pagination__jump-input"
            min={1}
            max={totalPages}
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            aria-label="Numero de pagina"
          />
          <button type="submit" className="pagination__jump-btn" aria-label="Ir a la pagina ingresada">
            Ir
          </button>
        </form>
      </div>
    </div>
  );
};
