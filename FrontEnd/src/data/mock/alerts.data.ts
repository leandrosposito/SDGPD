import type { Alert } from '@/shared/types/alert.types';

// ============================================================
// ALERTS MOCK DATA — Tanda 7 de la corrida completa (ADR-007).
// Mezcla de los 2 tipos, mezcla de leidas/no leidas, mezcla de
// severidades — orden mas reciente primero (mismo criterio que el
// resto de los mocks de eventos append-only del proyecto).
// ============================================================

export const ALERTS_MOCK_DATA: Alert[] = [
  { id: 'alr-015', tipo: 'producto-por-vencer', severidad: 'alta', creadoEn: '2026-09-07T09:00:00Z', leida: false, productId: 'inv-004', productName: 'Yogur Bebible 1L', branchId: 'branch-001', diasParaVencer: 2 },
  { id: 'alr-014', tipo: 'transferencia-retrasada', severidad: 'alta', creadoEn: '2026-09-07T08:30:00Z', leida: false, deliveryId: 'del-021', branchDestino: 'Sucursal Centro', diasRetraso: 3 },
  { id: 'alr-013', tipo: 'producto-por-vencer', severidad: 'media', creadoEn: '2026-09-06T18:00:00Z', leida: false, productId: 'inv-011', productName: 'Fiambre Jamon Cocido 500g', branchId: 'branch-002', diasParaVencer: 5 },
  { id: 'alr-012', tipo: 'transferencia-retrasada', severidad: 'media', creadoEn: '2026-09-06T15:20:00Z', leida: false, deliveryId: 'del-019', branchDestino: 'Sucursal Norte', diasRetraso: 1 },
  { id: 'alr-011', tipo: 'producto-por-vencer', severidad: 'baja', creadoEn: '2026-09-06T10:00:00Z', leida: false, productId: 'inv-007', productName: 'Leche Entera 1L', branchId: 'branch-001', diasParaVencer: 9 },
  { id: 'alr-010', tipo: 'transferencia-retrasada', severidad: 'baja', creadoEn: '2026-09-05T17:45:00Z', leida: true, deliveryId: 'del-015', branchDestino: 'Sucursal Centro', diasRetraso: 1 },
  { id: 'alr-009', tipo: 'producto-por-vencer', severidad: 'alta', creadoEn: '2026-09-05T12:00:00Z', leida: true, productId: 'inv-018', productName: 'Queso Cremoso 300g', branchId: 'branch-003', diasParaVencer: 1 },
  { id: 'alr-008', tipo: 'transferencia-retrasada', severidad: 'alta', creadoEn: '2026-09-05T09:10:00Z', leida: false, deliveryId: 'del-012', branchDestino: 'Sucursal Norte', diasRetraso: 4 },
  { id: 'alr-007', tipo: 'producto-por-vencer', severidad: 'media', creadoEn: '2026-09-04T16:30:00Z', leida: true, productId: 'inv-002', productName: 'Aceite Girasol 1.5L', branchId: 'branch-002', diasParaVencer: 6 },
  { id: 'alr-006', tipo: 'transferencia-retrasada', severidad: 'baja', creadoEn: '2026-09-04T11:00:00Z', leida: true, deliveryId: 'del-009', branchDestino: 'Sucursal Centro', diasRetraso: 1 },
  { id: 'alr-005', tipo: 'producto-por-vencer', severidad: 'baja', creadoEn: '2026-09-03T14:15:00Z', leida: true, productId: 'inv-013', productName: 'Yerba Taragui 1kg', branchId: 'branch-001', diasParaVencer: 12 },
  { id: 'alr-004', tipo: 'transferencia-retrasada', severidad: 'media', creadoEn: '2026-09-03T08:00:00Z', leida: false, deliveryId: 'del-006', branchDestino: 'Sucursal Norte', diasRetraso: 2 },
  { id: 'alr-003', tipo: 'producto-por-vencer', severidad: 'media', creadoEn: '2026-09-02T13:40:00Z', leida: true, productId: 'inv-009', productName: 'Galletitas Surtidas 200g', branchId: 'branch-003', diasParaVencer: 7 },
  { id: 'alr-002', tipo: 'transferencia-retrasada', severidad: 'baja', creadoEn: '2026-09-02T09:00:00Z', leida: true, deliveryId: 'del-003', branchDestino: 'Sucursal Centro', diasRetraso: 1 },
  { id: 'alr-001', tipo: 'producto-por-vencer', severidad: 'baja', creadoEn: '2026-09-01T10:00:00Z', leida: true, productId: 'inv-005', productName: 'Arroz Largo Fino 1kg', branchId: 'branch-002', diasParaVencer: 14 },
];
