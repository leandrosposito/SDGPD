import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';
import { toISODateString } from './dateRangePresets';
import './ExportButton.css';

// ============================================================
// ExportButton — Boton "Exportar" reusable (Excel/CSV), tarea
// transversal (DECISIONES_TECNICAS.md). Vive en shared/ui/ (R2, mismo
// criterio que DateRangeFilter/Table/Pagination): ningun listado
// importa el de otro, todos consumen este componente.
//
// No conoce ningun service: recibe `fetchRows` (una funcion que ya
// trae los datos a exportar, con los filtros vigentes de quien lo usa
// — ver *.service.ts#exportX) y `columns` (como traducir cada fila a
// columnas con headers en espanol). Generacion de Excel/CSV con `xlsx`
// (SheetJS, instalado desde cdn.sheetjs.com — ver DECISIONES_TECNICAS.md
// para el porque de esa fuente en vez del registry de npm). El CSV se
// arma con XLSX.utils.sheet_to_csv sobre la misma hoja que arma el
// Excel (una sola fuente de verdad de las columnas para los dos
// formatos) y se descarga con un Blob + <a download> nativo, sin
// sumar file-saver.
// ============================================================

export interface ExportColumn<T> {
  header: string;
  accessor: (row: T) => string | number;
}

export interface ExportFetchResult<T> {
  items: T[];
  truncated: boolean;
}

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

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ExportButton<T>({
  fileNamePrefix,
  columns,
  fetchRows,
  disabled = false,
  label = 'Exportar',
}: ExportButtonProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  async function handleExport(format: 'xlsx' | 'csv') {
    setIsOpen(false);
    setIsExporting(true);
    try {
      const { items, truncated } = await fetchRows();

      if (items.length === 0) {
        toast.error('No hay datos para exportar con los filtros actuales.');
        return;
      }

      const rows = items.map((row) =>
        Object.fromEntries(columns.map((col) => [col.header, col.accessor(row)]))
      );
      const worksheet = XLSX.utils.json_to_sheet(rows, { header: columns.map((c) => c.header) });
      const fileName = `${fileNamePrefix}_${toISODateString(new Date())}.${format}`;

      if (format === 'xlsx') {
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Datos');
        XLSX.writeFile(workbook, fileName);
      } else {
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        // BOM UTF-8: Excel abre el CSV con acentos/ñ correctos en vez
        // de romper el encoding al doble-clickearlo en Windows.
        downloadBlob(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' }), fileName);
      }

      if (truncated) {
        toast.warning(
          `Se exportaron las primeras ${items.length} filas: hay mas resultados de los que entran en un solo archivo de export.`
        );
      } else {
        toast.success(`Se exportaron ${items.length} filas a "${fileName}".`);
      }
    } catch {
      toast.error('No se pudo generar el archivo de exportacion.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="export-button" ref={containerRef}>
      <button
        type="button"
        className="export-button__trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={isExporting ? 'Exportando...' : 'Exportar listado a Excel o CSV'}
        disabled={disabled || isExporting}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <FileSpreadsheet size={16} aria-hidden="true" />
        {isExporting ? 'Exportando...' : label}
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
