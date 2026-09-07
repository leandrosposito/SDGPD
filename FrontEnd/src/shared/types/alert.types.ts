// ============================================================
// SHARED TYPE DEFINITIONS — Alertas del sistema (ADR-007, Tanda 7 de
// la corrida completa). Union discriminada por `tipo`, extensible: un
// tipo nuevo se agrega como un miembro mas de la union, sin tocar los
// existentes (mismo criterio que ADR-006 aplica a los ids — un switch
// exhaustivo sobre `tipo` avisa en tiempo de compilacion si falta
// contemplar un tipo nuevo).
// ============================================================

export type AlertSeverity = 'baja' | 'media' | 'alta';

interface AlertBase {
  id: string;
  severidad: AlertSeverity;
  creadoEn: string; // ISO
  // Leida/no leida es por USUARIO en el mundo real (ADR-007) — como
  // hoy no hay autenticacion multi-usuario real (AUDIT_6_ESTADO_GLOBAL.md:
  // no existe flujo de login/logout), se modela como un campo global
  // de la alerta en el mock. El dia que haya usuarios reales, este
  // campo pasa a vivir en una tabla de lectura por usuario+alerta, no
  // en la alerta misma — documentado para que no se asuma que ya esta
  // resuelto.
  leida: boolean;
}

export interface TransferenciaRetrasadaAlert extends AlertBase {
  tipo: 'transferencia-retrasada';
  deliveryId: string;
  branchDestino: string;
  diasRetraso: number;
}

export interface ProductoPorVencerAlert extends AlertBase {
  tipo: 'producto-por-vencer';
  productId: string;
  productName: string;
  branchId: string;
  diasParaVencer: number;
}

export type Alert = TransferenciaRetrasadaAlert | ProductoPorVencerAlert;
export type AlertType = Alert['tipo'];

export interface AlertsSummary {
  totalNoLeidas: number;
  porTipo: Record<AlertType, number>;
  porSeveridad: Record<AlertSeverity, number>;
}
