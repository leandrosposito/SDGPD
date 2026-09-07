import { useEffect, useRef, useState } from 'react';
import { FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';
import { useExportJob } from '@/shared/hooks/useExportJob';
import type { ExportColumn, ExportFetchResult } from '@/shared/api/exports/exportTypes';
import './ExportButton.css';

// ============================================================
// ExportButton — Boton "Exportar" reusable (Excel/CSV), tarea
// transversal (DECISIONES_TECNICAS.md). Vive en shared/ui/ (R2, mismo
// criterio que DateRangeFilter/Table/Pagination): ningun listado
// importa el de otro, todos consumen este componente.
//
// Tanda 6 (corrida completa, ADR-004): el archivo YA NO se arma aca —
// este componente no importa `xlsx` ni usa Blob/URL directamente.
// Delega en useExportJob (crea el job, pollea su estado) que a su vez
// delega en buildExportFile (la unica pieza que genera el archivo real,
// simulando "el servidor lo genero"). La firma publica de este
// componente (fileNamePrefix/columns/fetchRows/disabled/label) es
// IDENTICA a la version anterior a proposito: los 7 call-sites
// existentes no cambian ni una linea — solo cambia que ahora "exportar"
// es un job asincrono con progreso, no una descarga sincrona inmediata.
//
// `fetchRows` sigue siendo la funcion que cada listado ya pasa hoy
// (`() => exportX(filters)`, con `filters` ya sourced de la URL desde
// Tanda 4) — el contrato "los mismos filtros del listado" del ADR-004
// ya estaba resuelto antes de esta tanda, no hizo falta tocarlo.
// ============================================================

export type { ExportColumn, ExportFetchResult };

interface ExportButtonProps<T> {
  // Prefijo del nombre de archivo, ej. "ordenes-compra" ->
  // "ordenes-compra_2026-09-03.xlsx". Sin espacios/mayusculas por
  // convencion de nombre de archivo.
  fileNamePrefix: string;
  columns: ExportColumn<T>[];
  fetchRows: () => Promise<ExportFetchResult<T>>;
  disabled?: boolean;
  // Texto del boton (default "Exportar") — algunos listados conviven
  // con otro boton "Exportar" ya existente en la pagina (ninguno hoy,
  // pero deja la puerta abierta sin cambiar la firma despues).
  label?: string;
}

const STATUS_LABEL: Record<string, string> = {
  pendiente: 'Preparando...',
  procesando: 'Exportando...',
};

export function ExportButton<T>({
  fileNamePrefix,
  columns,
  fetchRows,
  disabled = false,
  label = 'Exportar',
}: ExportButtonProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { start, isRunning, status, progress } = useExportJob<T>();

  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  function handleExport(formato: 'xlsx' | 'csv') {
    setIsOpen(false);
    start({ fileNamePrefix, columns, fetchRows, formato });
  }

  const buttonLabel = isRunning
    ? `${STATUS_LABEL[status] ?? 'Exportando...'} ${progress}%`
    : label;

  return (
    <div className="export-button" ref={containerRef}>
      <button
        type="button"
        className="export-button__trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={isRunning ? `${buttonLabel}` : 'Exportar listado a Excel o CSV'}
        disabled={disabled || isRunning}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <FileSpreadsheet size={16} aria-hidden="true" />
        {buttonLabel}
        <ChevronDown size={14} aria-hidden="true" className={`export-button__chevron${isOpen ? ' export-button__chevron--open' : ''}`} />
      </button>

      {isOpen && (
        <ul className="export-button__menu" role="menu" aria-label="Formato de exportacion">
          <li role="none">
            <button type="button" role="menuitem" className="export-button__option" onClick={() => handleExport('xlsx')}>
              <FileSpreadsheet size={15} aria-hidden="true" />
              Exportar Excel (.xlsx)
            </button>
          </li>
          <li role="none">
            <button type="button" role="menuitem" className="export-button__option" onClick={() => handleExport('csv')}>
              <FileText size={15} aria-hidden="true" />
              Exportar CSV (.csv)
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
