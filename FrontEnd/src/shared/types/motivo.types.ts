// ============================================================
// motivo.types — Catalogo de motivos configurable por empresa
// (ADR-010 seccion 5, Tanda 9 del modelo logistico base).
//
// `codigo` nunca cambia una vez creado (lo que se reporta/agrupa),
// `descripcion` es editable (lo que ve el usuario). `requiereEvidencia`
// y `disparaLogisticaInversa` son flags de COMPORTAMIENTO, no solo
// metadatos: el catalogo decide caso por caso si ese motivo puntual
// exige evidencia adjunta y si dispara el circuito de logistica
// inversa (ADR-010 seccion 6 — el circuito EN SI, mover stock, queda
// fuera de esta tanda; el flag existe para que una tanda futura lo
// consuma sin tener que volver a tocar el catalogo).
//
// `OTRO` es un codigo mas del catalogo (no un caso especial aparte):
// cuando se elige, la UI pide texto libre y lo guarda en
// DeliveryNoteLine.motivoRechazo — ese texto tiene que ser consultable
// para revision periodica (ver `MotivoTipo`/uso en deliveries.service.ts).
//
// Catalogos separados por tipo de evento (rechazo / reprogramacion /
// no-entrega) — Tanda 9 solo siembra y conecta el de 'rechazo' en la
// UI (RegistrarEntregaModal); 'reprogramacion' y 'no-entrega' quedan
// con el tipo definido pero SIN sembrar ni conectar (ReprogramarModal
// sigue con motivo de texto libre en esta tanda) — ver el informe de
// Fase 2 de la sesion para el porque de este recorte de alcance.
// ============================================================

export type MotivoTipo = 'rechazo' | 'reprogramacion' | 'no-entrega';

export interface MotivoCatalogItem {
  codigo: string;
  tipo: MotivoTipo;
  descripcion: string;
  activo: boolean;
  requiereEvidencia: boolean;
  disparaLogisticaInversa: boolean;
}

export const MOTIVO_OTRO_CODIGO = 'OTRO';
