import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { createExportJob, getExportJobStatus, type ExportJobStatus } from '@/shared/api/exports/exportJobs';
import { buildExportFile } from '@/shared/api/exports/buildExportFile';
import type { ExportColumn, ExportFetchResult, ExportFormat } from '@/shared/api/exports/exportTypes';

// ============================================================
// useExportJob — hook compartido de ADR-004 (Tanda 6, corrida
// completa): crea el job de exportacion, lo pollea, y dispara la
// descarga real + feedback de Sonner cuando termina. Un unico hook
// para toda la app (ExportButton.tsx es su unico consumidor) — ningun
// listado reimplementa su propio polling.
//
// El archivo real lo arma buildExportFile (la unica pieza que importa
// xlsx/usa Blob) — este hook nunca genera el archivo el mismo, solo
// orquesta el job y reacciona a su resultado.
// ============================================================

const POLL_INTERVAL_MS = 250;

export type UseExportJobStatus = ExportJobStatus | 'idle';

export interface StartExportParams<T> {
  fileNamePrefix: string;
  columns: ExportColumn<T>[];
  fetchRows: () => Promise<ExportFetchResult<T>>;
  formato: ExportFormat;
}

export interface UseExportJobResult<T> {
  status: UseExportJobStatus;
  progress: number;
  isRunning: boolean;
  start: (params: StartExportParams<T>) => void;
}

function triggerDownload(downloadUrl: string, fileName: string) {
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // No revocamos la URL de inmediato: algunos navegadores necesitan que
  // siga viva un instante despues del click para completar la descarga.
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 30_000);
}

export function useExportJob<T>(): UseExportJobResult<T> {
  const [state, setState] = useState<{ status: UseExportJobStatus; progress: number }>({
    status: 'idle',
    progress: 0,
  });
  // Token que invalida cualquier polling en vuelo de un job anterior
  // (un segundo click en "Exportar" antes de que el primero termine, o
  // el componente que se desmonta) — evita actualizar estado de un job
  // que ya no importa.
  const activeTokenRef = useRef(0);

  useEffect(() => {
    return () => {
      activeTokenRef.current += 1;
    };
  }, []);

  function start(params: StartExportParams<T>) {
    const token = ++activeTokenRef.current;
    setState({ status: 'pendiente', progress: 0 });

    void (async () => {
      const { jobId } = await createExportJob({
        fileNamePrefix: params.fileNamePrefix,
        formato: params.formato,
        columns: params.columns,
        fetchRows: params.fetchRows,
        buildFile: buildExportFile,
      });
      if (activeTokenRef.current !== token) return;
      poll(jobId, token);
    })();
  }

  function poll(jobId: string, token: number) {
    setTimeout(async () => {
      if (activeTokenRef.current !== token) return;

      const jobState = await getExportJobStatus(jobId);
      if (activeTokenRef.current !== token) return;

      setState({ status: jobState.status, progress: jobState.progreso });

      if (jobState.status === 'pendiente' || jobState.status === 'procesando') {
        poll(jobId, token);
        return;
      }

      if (jobState.status === 'listo' && jobState.downloadUrl && jobState.fileName) {
        triggerDownload(jobState.downloadUrl, jobState.fileName);
        if (jobState.truncado) {
          toast.warning(
            `Se exportaron las primeras ${jobState.totalFilas} filas: hay mas resultados de los que entran en un solo archivo de export.`
          );
        } else {
          toast.success(`Se exportaron ${jobState.totalFilas} filas a "${jobState.fileName}".`);
        }
      } else if (jobState.status === 'vacio') {
        toast.error('No hay datos para exportar con los filtros actuales.');
      } else if (jobState.status === 'error') {
        toast.error(jobState.errorMessage ?? 'No se pudo generar el archivo de exportacion.');
      }
    }, POLL_INTERVAL_MS);
  }

  return {
    status: state.status,
    progress: state.progress,
    isRunning: state.status === 'pendiente' || state.status === 'procesando',
    start,
  };
}
