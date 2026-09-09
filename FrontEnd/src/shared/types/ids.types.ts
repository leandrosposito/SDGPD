// ============================================================
// ids.types — Branded types para los identificadores de dominio
// (ADR-006, Tanda 5 de la corrida completa). AUDIT_4_IDS_RELACIONES.md
// (hallazgo MEDIO #2) confirmo que todo id del proyecto era `string`
// plano: TypeScript no distinguia `OrderId` de `BranchId` en la misma
// firma (ej. getStockForBranch(empresaId, productId, branchId) — los 3
// son string, invertir dos no tira error de compilacion).
//
// Migracion incremental (ADR-006): Tanda 5 trajo OrderId, BranchId,
// OrderLineId y ClientId. Tanda 8 (entregas) agrega DeliveryId, que es
// lo unico que necesitaba de esta lista. ProductId queda pendiente
// para cuando una tanda futura lo necesite.
//
// Patron: interseccion con un campo fantasma (`__brand`), nunca existe
// en runtime — el UNICO `as` aceptable del proyecto para estos tipos
// es el que esta DENTRO de cada constructor `as<Tipo>Id`, justo
// despues de validar el formato. Cualquier otro `as *Id` fuera de este
// archivo es exactamente el patron prohibido por las reglas de
// operacion (tapar un error de tipos).
//
// Cada tipo expone DOS mecanismos, a proposito (ADR-006):
// - `as<Tipo>Id(raw)`: valida y devuelve el branded type, o LANZA
//   InvalidIdError si el formato no matchea — para puntos donde un id
//   invalido es un error real (parseo de URL, alta de un formulario,
//   sembrado del mock).
// - `is<Tipo>Id(raw)`: type guard que devuelve boolean sin lanzar —
//   para chequeos condicionales donde no corresponde interrumpir el
//   flujo (ej. descartar en silencio un valor que no es un id valido,
//   en vez de crashear la pantalla).
// ============================================================

export class InvalidIdError extends Error {
  readonly idType: string;
  readonly received: string;

  constructor(idType: string, received: string) {
    super(`${idType} invalido: se esperaba el formato de ${idType}, se recibio "${received}".`);
    this.name = 'InvalidIdError';
    this.idType = idType;
    this.received = received;
  }
}

export type OrderId = string & { readonly __brand: 'OrderId' };
export type BranchId = string & { readonly __brand: 'BranchId' };
export type OrderLineId = string & { readonly __brand: 'OrderLineId' };
export type ClientId = string & { readonly __brand: 'ClientId' };
export type DeliveryId = string & { readonly __brand: 'DeliveryId' };
// Tanda 9 (modelo logistico base, ADR-010/AUDIT_15 hallazgo #13): estos
// dos quedaban como string plano pese a que Delivery/DeliveryNote ya
// tenian el resto de sus relaciones tipadas.
export type DeliveryNoteId = string & { readonly __brand: 'DeliveryNoteId' };
export type DeliveryHistoryEventId = string & { readonly __brand: 'DeliveryHistoryEventId' };

const ORDER_ID_PATTERN = /^ord-/;
const BRANCH_ID_PATTERN = /^branch-/;
const ORDER_LINE_ID_PATTERN = /^oi-/;
const CLIENT_ID_PATTERN = /^cli-/;
const DELIVERY_ID_PATTERN = /^del-/;
const DELIVERY_NOTE_ID_PATTERN = /^remito-/;
const DELIVERY_HISTORY_EVENT_ID_PATTERN = /^dh-/;

export function isOrderId(raw: string): raw is OrderId {
  return ORDER_ID_PATTERN.test(raw);
}

export function asOrderId(raw: string): OrderId {
  if (!isOrderId(raw)) throw new InvalidIdError('OrderId', raw);
  return raw;
}

export function isBranchId(raw: string): raw is BranchId {
  return BRANCH_ID_PATTERN.test(raw);
}

export function asBranchId(raw: string): BranchId {
  if (!isBranchId(raw)) throw new InvalidIdError('BranchId', raw);
  return raw;
}

export function isOrderLineId(raw: string): raw is OrderLineId {
  return ORDER_LINE_ID_PATTERN.test(raw);
}

export function asOrderLineId(raw: string): OrderLineId {
  if (!isOrderLineId(raw)) throw new InvalidIdError('OrderLineId', raw);
  return raw;
}

export function isClientId(raw: string): raw is ClientId {
  return CLIENT_ID_PATTERN.test(raw);
}

export function asClientId(raw: string): ClientId {
  if (!isClientId(raw)) throw new InvalidIdError('ClientId', raw);
  return raw;
}

export function isDeliveryId(raw: string): raw is DeliveryId {
  return DELIVERY_ID_PATTERN.test(raw);
}

export function asDeliveryId(raw: string): DeliveryId {
  if (!isDeliveryId(raw)) throw new InvalidIdError('DeliveryId', raw);
  return raw;
}

export function isDeliveryNoteId(raw: string): raw is DeliveryNoteId {
  return DELIVERY_NOTE_ID_PATTERN.test(raw);
}

export function asDeliveryNoteId(raw: string): DeliveryNoteId {
  if (!isDeliveryNoteId(raw)) throw new InvalidIdError('DeliveryNoteId', raw);
  return raw;
}

export function isDeliveryHistoryEventId(raw: string): raw is DeliveryHistoryEventId {
  return DELIVERY_HISTORY_EVENT_ID_PATTERN.test(raw);
}

export function asDeliveryHistoryEventId(raw: string): DeliveryHistoryEventId {
  if (!isDeliveryHistoryEventId(raw)) throw new InvalidIdError('DeliveryHistoryEventId', raw);
  return raw;
}
