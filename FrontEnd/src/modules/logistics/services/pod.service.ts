import type { Pod, PodReceptor, PodUbicacion } from '@/shared/types/pod.types';
import type { DeliveryId, StopId } from '@/shared/types/ids.types';
import { asPodId } from '@/shared/types/ids.types';
import { httpClient } from '@/shared/api/httpClient';

// ============================================================
// pod.service — Proof of Delivery (Tanda 10B, ADR-010 seccion 7).
// Store propio y chico, separado de trips.service.ts para que un
// viaje no cargue en memoria el detalle completo de cada POD (el
// viaje solo necesita saber si una parada ya tiene POD, no el detalle
// entero) — mismo criterio de separacion que deliveryNotesStore
// respecto de deliveriesStore en deliveries.service.ts.
// ============================================================

let podsStore: Pod[] = [];

export interface PodInput {
  receptor: PodReceptor;
  firmaEvidenciaId?: string;
  imagenesIds: string[];
  ubicacion?: PodUbicacion;
  observaciones?: string;
  // Capturado al ABRIR PodModal (ADR-010 seccion 7), no al confirmar —
  // mismo criterio que la clave de idempotencia (ADR-010 seccion 4).
  timestampDispositivo: string;
}

// Llamada "servidor a servidor" (mismo criterio que
// applyDeliveryToOrderLines en orders.service.ts): trips.service.ts la
// invoca desde DENTRO de su propio resolver mock, ya envuelto en
// httpClient+withIdempotency — no se envuelve una segunda vez aca para
// no apilar latencia simulada sobre la misma accion de usuario.
export async function registerPodEvidence(
  empresaId: string,
  deliveryId: DeliveryId,
  stopId: StopId,
  input: PodInput,
  quien: string
): Promise<Pod> {
  void empresaId;
  const pod: Pod = {
    id: asPodId(`pod-${Date.now()}`),
    deliveryId,
    stopId,
    receptor: input.receptor,
    firmaEvidenciaId: input.firmaEvidenciaId,
    imagenesIds: input.imagenesIds,
    ubicacion: input.ubicacion,
    observaciones: input.observaciones,
    timestampDispositivo: input.timestampDispositivo,
    timestampServidor: new Date().toISOString(),
    creadoPor: quien,
  };
  podsStore = [...podsStore, pod];
  return pod;
}

// Consumido por TripDetailPanel: si una entrega ya tiene POD, el boton
// "Registrar POD" se deshabilita en vez de permitir sobreescribirlo
// (el POD, como el remito, es un hecho ya ocurrido — append-only,
// nunca se edita).
export async function getPodForDelivery(empresaId: string, deliveryId: DeliveryId, signal?: AbortSignal): Promise<Pod | null> {
  return httpClient.request<Pod | null>({
    method: 'GET',
    path: `/deliveries/${deliveryId}/pod`,
    params: { empresaId },
    signal,
    mock: () => podsStore.find((p) => p.deliveryId === deliveryId) ?? null,
  });
}
