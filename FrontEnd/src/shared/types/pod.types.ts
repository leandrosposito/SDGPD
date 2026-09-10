import type { PodId, DeliveryId, StopId } from './ids.types';

// ============================================================
// pod.types — Proof of Delivery (Tanda 10B, ADR-010 seccion 7,
// reusa el pipeline de evidencia de ADR-005 sin extenderlo). La firma
// se captura como imagen (canvas rasterizado a PNG) y sube por el
// MISMO flujo que las fotos (uploads.service.ts) — ver PodModal.tsx.
// ============================================================

// ADR-010 seccion 7, correccion 2026-09-09: contactId presente y NULO
// desde el dia uno (no ausente/undefined) — asi un POD viejo dice
// explicitamente "no tenia contacto asociado" el dia que Clientes
// gane contactos multiples, sin ambiguedad ni migracion de datos.
export interface PodReceptor {
  nombre: string;
  documento?: string;
  contactId?: string | null;
}

export interface PodUbicacion {
  lat: number;
  lng: number;
  precision: number;
}

export interface Pod {
  id: PodId;
  deliveryId: DeliveryId;
  stopId: StopId;
  receptor: PodReceptor;
  firmaEvidenciaId?: string;
  imagenesIds: string[];
  ubicacion?: PodUbicacion;
  observaciones?: string;
  // Los dos timestamps, nunca uno solo (ADR-010 seccion 7): dispositivo
  // = reloj del celular al momento del evento (capturado al ABRIR el
  // modal, no al confirmar — ver PodModal.tsx); servidor = cuando el
  // sistema lo recibio, fuente de verdad para ordenar/auditar.
  timestampDispositivo: string;
  timestampServidor: string;
  creadoPor: string;
}
