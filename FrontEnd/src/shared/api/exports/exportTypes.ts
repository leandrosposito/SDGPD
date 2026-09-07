// ============================================================
// Tipos compartidos de exportacion (Tanda 6, corrida completa,
// ADR-004). Separados en su propio archivo para que tanto el modulo
// de jobs (exportJobs.ts, sin dependencias de navegador) como el que
// arma el archivo real (buildExportFile.ts, depende de xlsx/Blob/URL)
// los importen sin acoplarse entre si.
// ============================================================

export interface ExportColumn<T> {
  header: string;
  accessor: (row: T) => string | number;
}

export interface ExportFetchResult<T> {
  items: T[];
  truncated: boolean;
}

export type ExportFormat = 'xlsx' | 'csv';
