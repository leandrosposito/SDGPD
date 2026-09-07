import type { ExportColumn, ExportFetchResult, ExportFormat } from './exportTypes';

// ============================================================
// exportJobs — Simulador del "servidor" de exportacion (Tanda 6,
// corrida completa, ADR-004). El cliente NUNCA arma el CSV/XLSX en su
// propio render: pide un job (createExportJob), lo pollea
// (getExportJobStatus) y recien cuando esta 'listo' abre el
// downloadUrl que el "servidor" (este modulo) genero.
//
// Contrato mock de POST /{recurso}/export -> 202 {jobId} y
// GET /exports/{jobId} -> {estado, progreso, downloadUrl?} del ADR.
//
// Diseño a proposito para poder testear la MAQUINA DE ESTADOS sin DOM
// real (ver scripts/smoke/tanda-6.smoke.mjs): este archivo NO importa
// xlsx ni usa Blob/URL — quien arma el archivo real (buildExportFile.ts,
// que si depende del navegador) se inyecta como parametro
// (`buildFile`), nunca se importa aca adentro. El smoke script puede
// ejercitar exportJobStepAt/createExportJob/getExportJobStatus pasando
// un `buildFile` falso, sin necesitar `xlsx` ni un DOM.
// ============================================================

export type ExportJobStatus = 'pendiente' | 'procesando' | 'listo' | 'vacio' | 'error';

export interface ExportJobState {
  status: ExportJobStatus;
  progreso: number;
  downloadUrl?: string;
  fileName?: string;
  totalFilas?: number;
  truncado?: boolean;
  errorMessage?: string;
}

interface ExportJobStep {
  status: ExportJobStatus;
  progreso: number;
  isFinal: boolean;
}

// Los 3 pasos intermedios simulados antes del estado final (que decide
// createExportJob segun el resultado real de fetchRows/buildFile, no
// esta funcion). PURA: mismo input, mismo output siempre — es lo que
// permite al smoke script ejercitarla sin timers reales.
const INTERMEDIATE_STEPS: ReadonlyArray<{ status: ExportJobStatus; progreso: number }> = [
  { status: 'pendiente', progreso: 0 },
  { status: 'procesando', progreso: 30 },
  { status: 'procesando', progreso: 60 },
  { status: 'procesando', progreso: 90 },
];

export function exportJobStepAt(stepIndex: number): ExportJobStep {
  const step = INTERMEDIATE_STEPS[stepIndex];
  if (step) return { ...step, isFinal: false };
  // Paso final: el progreso llega a 100, pero el status real (listo /
  // vacio / error) lo resuelve createExportJob de forma asincrona
  // (depende de fetchRows/buildFile) — este valor es solo un
  // placeholder mientras tanto.
  return { status: 'procesando', progreso: 100, isFinal: true };
}

const DEFAULT_STEP_DELAY_MS = 500; // 4 pasos * 500ms = 2s antes del estado final

export interface BuildFileResult {
  downloadUrl: string;
  fileName: string;
}

export interface CreateExportJobParams<T> {
  fileNamePrefix: string;
  formato: ExportFormat;
  columns: ExportColumn<T>[];
  fetchRows: () => Promise<ExportFetchResult<T>>;
  // Genera el archivo real — depende del navegador (Blob/URL/xlsx, ver
  // buildExportFile.ts). Inyectado a proposito: este modulo no debe
  // importar xlsx nunca (ver comentario de cabecera).
  buildFile: (items: T[], columns: ExportColumn<T>[], formato: ExportFormat, fileNamePrefix: string) => BuildFileResult;
  // Delay entre pasos en ms — solo para acortarlo en tests, default
  // DEFAULT_STEP_DELAY_MS en produccion.
  stepDelayMs?: number;
}

const jobs = new Map<string, ExportJobState>();
let nextJobSeq = 1;

export async function createExportJob<T>(params: CreateExportJobParams<T>): Promise<{ jobId: string }> {
  const jobId = `export-job-${nextJobSeq++}`;
  const delay = params.stepDelayMs ?? DEFAULT_STEP_DELAY_MS;
  jobs.set(jobId, { status: 'pendiente', progreso: 0 });

  function runStep(stepIndex: number) {
    const step = exportJobStepAt(stepIndex);
    if (!step.isFinal) {
      jobs.set(jobId, { status: step.status, progreso: step.progreso });
      setTimeout(() => runStep(stepIndex + 1), delay);
      return;
    }
    void finalize();
  }

  async function finalize() {
    try {
      const { items, truncated } = await params.fetchRows();

      if (items.length === 0) {
        jobs.set(jobId, { status: 'vacio', progreso: 100 });
        return;
      }

      const { downloadUrl, fileName } = params.buildFile(items, params.columns, params.formato, params.fileNamePrefix);
      jobs.set(jobId, {
        status: 'listo',
        progreso: 100,
        downloadUrl,
        fileName,
        totalFilas: items.length,
        truncado: truncated,
      });
    } catch (err) {
      jobs.set(jobId, {
        status: 'error',
        progreso: 100,
        errorMessage: err instanceof Error ? err.message : 'No se pudo generar el archivo de exportacion.',
      });
    }
  }

  runStep(0);
  return { jobId };
}

export async function getExportJobStatus(jobId: string): Promise<ExportJobState> {
  const state = jobs.get(jobId);
  if (!state) {
    return { status: 'error', progreso: 0, errorMessage: 'El trabajo de exportacion no existe.' };
  }
  return state;
}
