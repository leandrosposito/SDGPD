import type { ClientAccount } from '@/shared/types/client.types';

// ============================================================
// orderEligibility — Tanda 17 (ADR-015). Cierra la migracion a medias
// de Tanda 16: ClientAccount.isActive se persistia y se editaba
// (ClientSettingsTab) pero nadie lo leia — un cliente dado de baja
// seguia en el selector de CreateOrderModal y createOrder lo aceptaba.
//
// Unica fuente de la regla "se le puede cargar un pedido nuevo a este
// cliente" y de los motivos de rechazo de un alta de pedido — mismo
// criterio que stopVisitEligibility.ts (Tanda 13): la usan los dos
// lados, nunca dos implementaciones del mismo chequeo.
// - orders.service.ts#createOrder llama getCreateOrderBlockReason
//   server-side, AUTORITATIVA.
// - CreateOrderModal.tsx filtra el selector con
//   isClientSelectableForOrder (solo para no ofrecer lo que el
//   servidor va a rechazar igual) y traduce el motivo con
//   describeCreateOrderReason.
//
// Sin dependencia de httpClient: se ejercita con un smoke script puro
// (scripts/smoke/tanda-17.smoke.mjs).
// ============================================================

export type CreateOrderReason = 'no-items' | 'client-not-found' | 'inactive-client' | 'inactive-product';

// Un cliente dado de baja conserva su historial (pedidos viejos,
// cuenta corriente), pero no recibe pedidos nuevos.
export function isClientSelectableForOrder(client: Pick<ClientAccount, 'isActive'>): boolean {
  return client.isActive;
}

export interface CreateOrderEligibilityInput {
  itemCount: number;
  // null = el id del pedido no resuelve a ningun cliente de la empresa.
  client: Pick<ClientAccount, 'isActive'> | null;
  hasInactiveProduct: boolean;
}

// Orden de los chequeos: del mas barato/estructural al mas especifico
// — un pedido sin items ni siquiera necesita mirar el cliente.
export function getCreateOrderBlockReason(input: CreateOrderEligibilityInput): CreateOrderReason | null {
  if (input.itemCount === 0) return 'no-items';
  if (input.client === null) return 'client-not-found';
  if (!isClientSelectableForOrder(input.client)) return 'inactive-client';
  if (input.hasInactiveProduct) return 'inactive-product';
  return null;
}

// `detail` = dato puntual del rechazo que el servidor adjunta (hoy, el
// producto dado de baja en 'inactive-product').
export function describeCreateOrderReason(reason: CreateOrderReason, detail?: string): string {
  switch (reason) {
    case 'no-items':
      return 'El pedido necesita al menos un producto.';
    case 'client-not-found':
      return 'El cliente elegido ya no existe. Elegi otro cliente.';
    case 'inactive-client':
      return 'El cliente elegido esta dado de baja y no puede recibir pedidos nuevos.';
    case 'inactive-product':
      return detail
        ? `El producto ${detail} esta dado de baja y no puede agregarse a un pedido.`
        : 'Uno de los productos cargados esta dado de baja. Quitalo del pedido.';
  }
}
