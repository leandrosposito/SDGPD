import type { Delivery } from '../../../shared/types/logistics.types';

// ============================================================
// deliveries.service — Acceso a datos de entregas
// Hoy filtra en memoria sobre el mock; el mismo contrato de
// funcion (recibir la fecha como parametro) sirve para el dia
// en que esto pase a resolverse contra una API real.
// ============================================================

function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDeliveriesForDate(deliveries: Delivery[], date: Date): Delivery[] {
  const targetDate = toISODate(date);
  return deliveries.filter((delivery) => delivery.date === targetDate);
}
