import * as XLSX from 'xlsx';
import { toLocalDateString } from '@/shared/utils/date';
import type { ExportColumn, ExportFormat } from './exportTypes';
import type { BuildFileResult } from './exportJobs';

// ============================================================
// buildExportFile — la UNICA pieza de la Tanda 6 que depende del
// navegador (Blob/URL.createObjectURL) y de `xlsx` (SheetJS, ya
// instalada, ver package.json). Simula "el servidor genero el
// archivo": arma el workbook/CSV real y devuelve una URL descargable —
// dentro de las limitaciones de no tener backend real, es la unica
// forma honesta de tener un archivo de verdad al final del job.
//
// A proposito en un archivo separado de exportJobs.ts: ese modulo se
// ejercita en el smoke script sin DOM (ver scripts/smoke/tanda-6.smoke.mjs),
// inyectando esta funcion solo en produccion (useExportJob.ts).
// ============================================================

export function buildExportFile<T>(
  items: T[],
  columns: ExportColumn<T>[],
  formato: ExportFormat,
  fileNamePrefix: string
): BuildFileResult {
  const rows = items.map((row) => Object.fromEntries(columns.map((col) => [col.header, col.accessor(row)])));
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: columns.map((c) => c.header) });
  const fileName = `${fileNamePrefix}_${toLocalDateString(new Date())}.${formato}`;

  if (formato === 'xlsx') {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Datos');
    const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    return { downloadUrl: URL.createObjectURL(blob), fileName };
  }

  const csv = XLSX.utils.sheet_to_csv(worksheet);
  // BOM UTF-8: Excel abre el CSV con acentos/ñ correctos en vez de
  // romper el encoding al doble-clickearlo en Windows.
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
  return { downloadUrl: URL.createObjectURL(blob), fileName };
}
