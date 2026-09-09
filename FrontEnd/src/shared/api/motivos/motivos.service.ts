import type { MotivoCatalogItem, MotivoTipo } from '@/shared/types/motivo.types';
import { MOTIVOS_MOCK_DATA } from '@/data/mock/motivos.data';
import { httpClient } from '@/shared/api/httpClient';

// ============================================================
// motivos.service — Catalogo de motivos (Tanda 9, ADR-010 seccion 5).
// Vive en shared/api (no en un modulo) porque el catalogo es
// transversal: logistics lo consume hoy (rechazo en registrarEntrega),
// otro modulo podria consumirlo el dia que 'reprogramacion'/
// 'no-entrega' se implementen — ver motivo.types.ts para el recorte
// de alcance de esta tanda.
//
// Solo lectura por ahora: no hay alta/edicion de motivos desde la UI
// en esta tanda, el catalogo se siembra fijo en data/mock/motivos.data.ts.
// ============================================================

// const, no let: catalogo de solo lectura esta tanda (sin
// alta/edicion/baja desde la UI, ver comentario de arriba) — a
// diferencia de deliveriesStore/ordersDTOStore, no hay ninguna mutacion
// que reasignarla.
const motivosStore: MotivoCatalogItem[] = structuredClone(MOTIVOS_MOCK_DATA);

export async function getMotivoCatalog(
  empresaId: string,
  tipo: MotivoTipo,
  signal?: AbortSignal
): Promise<MotivoCatalogItem[]> {
  return httpClient.request<MotivoCatalogItem[]>({
    method: 'GET',
    path: '/motivos',
    params: { empresaId, tipo },
    signal,
    mock: () => motivosStore.filter((m) => m.tipo === tipo && m.activo),
  });
}

// Nota de alcance (ADR-010 seccion 5): "los textos de Otro deben
// quedar consultables" se resuelve esta tanda guardando
// motivoCodigo/motivoOtroTexto en cada DeliveryNoteLine (ver
// deliveryNote.types.ts) en vez de descartar el texto libre — no en
// una pantalla de revision nueva, que no forma parte del alcance de
// Tanda 9 (no esta entre los 8 items pedidos).
