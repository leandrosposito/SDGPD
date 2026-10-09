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
// Formato aceptado: UUID (el del backend) o el prefijo legado del mock
// (ver UUID_PATTERN mas abajo).
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
// Tanda 10B (capa operativa, ADR-011): vehiculos/choferes/viajes/paradas/POD.
export type VehicleId = string & { readonly __brand: 'VehicleId' };
export type DriverId = string & { readonly __brand: 'DriverId' };
export type TripId = string & { readonly __brand: 'TripId' };
export type StopId = string & { readonly __brand: 'StopId' };
export type PodId = string & { readonly __brand: 'PodId' };

// ADR-BE-004 (sub-decision 1, BE-0b): el backend genera UUID v7. Mientras
// un modulo siga sobre el adaptador mock, sus ids legados tienen prefijo
// (`ord-001`, `cli-001`...), asi que cada constructor acepta UUID O su
// prefijo legado. El prefijo se elimina cuando el ultimo modulo este
// conectado. Un UUID pasa el guard de cualquier tipo: la distincion entre
// tipos de id la da el branded type del compilador, no el formato.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function matchesIdFormat(legacyPrefix: RegExp, raw: string): boolean {
  return UUID_PATTERN.test(raw) || legacyPrefix.test(raw);
}

const ORDER_ID_PATTERN = /^ord-/;
const BRANCH_ID_PATTERN = /^branch-/;
const ORDER_LINE_ID_PATTERN = /^oi-/;
const CLIENT_ID_PATTERN = /^cli-/;
const DELIVERY_ID_PATTERN = /^del-/;
const DELIVERY_NOTE_ID_PATTERN = /^remito-/;
const DELIVERY_HISTORY_EVENT_ID_PATTERN = /^dh-/;
const VEHICLE_ID_PATTERN = /^veh-/;
const DRIVER_ID_PATTERN = /^drv-/;
const TRIP_ID_PATTERN = /^trip-/;
const STOP_ID_PATTERN = /^stop-/;
const POD_ID_PATTERN = /^pod-/;

export function isOrderId(raw: string): raw is OrderId {
  return matchesIdFormat(ORDER_ID_PATTERN, raw);
}

export function asOrderId(raw: string): OrderId {
  if (!isOrderId(raw)) throw new InvalidIdError('OrderId', raw);
  return raw;
}

export function isBranchId(raw: string): raw is BranchId {
  return matchesIdFormat(BRANCH_ID_PATTERN, raw);
}

export function asBranchId(raw: string): BranchId {
  if (!isBranchId(raw)) throw new InvalidIdError('BranchId', raw);
  return raw;
}

export function isOrderLineId(raw: string): raw is OrderLineId {
  return matchesIdFormat(ORDER_LINE_ID_PATTERN, raw);
}

export function asOrderLineId(raw: string): OrderLineId {
  if (!isOrderLineId(raw)) throw new InvalidIdError('OrderLineId', raw);
  return raw;
}

export function isClientId(raw: string): raw is ClientId {
  return matchesIdFormat(CLIENT_ID_PATTERN, raw);
}

export function asClientId(raw: string): ClientId {
  if (!isClientId(raw)) throw new InvalidIdError('ClientId', raw);
  return raw;
}

export function isDeliveryId(raw: string): raw is DeliveryId {
  return matchesIdFormat(DELIVERY_ID_PATTERN, raw);
}

export function asDeliveryId(raw: string): DeliveryId {
  if (!isDeliveryId(raw)) throw new InvalidIdError('DeliveryId', raw);
  return raw;
}

export function isDeliveryNoteId(raw: string): raw is DeliveryNoteId {
  return matchesIdFormat(DELIVERY_NOTE_ID_PATTERN, raw);
}

export function asDeliveryNoteId(raw: string): DeliveryNoteId {
  if (!isDeliveryNoteId(raw)) throw new InvalidIdError('DeliveryNoteId', raw);
  return raw;
}

export function isDeliveryHistoryEventId(raw: string): raw is DeliveryHistoryEventId {
  return matchesIdFormat(DELIVERY_HISTORY_EVENT_ID_PATTERN, raw);
}

export function asDeliveryHistoryEventId(raw: string): DeliveryHistoryEventId {
  if (!isDeliveryHistoryEventId(raw)) throw new InvalidIdError('DeliveryHistoryEventId', raw);
  return raw;
}

export function isVehicleId(raw: string): raw is VehicleId {
  return matchesIdFormat(VEHICLE_ID_PATTERN, raw);
}

export function asVehicleId(raw: string): VehicleId {
  if (!isVehicleId(raw)) throw new InvalidIdError('VehicleId', raw);
  return raw;
}

export function isDriverId(raw: string): raw is DriverId {
  return matchesIdFormat(DRIVER_ID_PATTERN, raw);
}

export function asDriverId(raw: string): DriverId {
  if (!isDriverId(raw)) throw new InvalidIdError('DriverId', raw);
  return raw;
}

export function isTripId(raw: string): raw is TripId {
  return matchesIdFormat(TRIP_ID_PATTERN, raw);
}

export function asTripId(raw: string): TripId {
  if (!isTripId(raw)) throw new InvalidIdError('TripId', raw);
  return raw;
}

export function isStopId(raw: string): raw is StopId {
  return matchesIdFormat(STOP_ID_PATTERN, raw);
}

export function asStopId(raw: string): StopId {
  if (!isStopId(raw)) throw new InvalidIdError('StopId', raw);
  return raw;
}

export function isPodId(raw: string): raw is PodId {
  return matchesIdFormat(POD_ID_PATTERN, raw);
}

export function asPodId(raw: string): PodId {
  if (!isPodId(raw)) throw new InvalidIdError('PodId', raw);
  return raw;
}
