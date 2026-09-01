import type { Delivery } from '@/shared/types/logistics.types';

// ============================================================
// deliveries.service — Acceso a datos de entregas
// Hoy filtra en memoria sobre el mock; el mismo contrato de
// funcion (recibir fecha y sucursal como parametros) sirve para el
// dia en que esto pase a resolverse contra una API real.
//
// branchId es un parametro explicito, no se lee de ningun store
// dentro del servicio: mantiene la capa de datos sin estado global
// oculto (ver DECISIONES_TECNICAS.md, D4). Que el front mande este
// branchId es una conveniencia de UI, no una autorizacion — el
// backend real debera validar igual que la sucursal pedida
// pertenezca a la empresa de la sesion antes de responder.
// ============================================================

function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDeliveriesForDate(
  deliveries: Delivery[],
  date: Date,
  branchId: Delivery['branchId']
): Delivery[] {
  const targetDate = toISODate(date);
  return deliveries.filter(
    (delivery) => delivery.date === targetDate && delivery.branchId === branchId
  );
}
