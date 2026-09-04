// ============================================================
// dto.ts (settings/subscription) — Forma que tendría la respuesta de
// un backend real (Tanda 3c de escalabilidad). Solo el historial de
// cobros (`InvoiceRecord`) tiene un dato real detrás — la card "Plan
// Actual" de TabSubscription.tsx es texto hardcodeado en el JSX, sin
// ningún tipo de dominio ni mock (ni siquiera un campo `plan`/`monto`
// en otro lado): no se migra, no se inventa un DTO para eso. Ver
// docs/DECISIONES_TECNICAS.md.
// ============================================================

export interface InvoiceRecordDTO {
  id: string;
  fecha: string;
  monto: number;
  estado: 'paid' | 'pending';
  plan: string;
}

export interface InvoicesPageDTO {
  data: InvoiceRecordDTO[];
  meta: {
    total: number;
    page: number;
    page_size: number;
  };
}
