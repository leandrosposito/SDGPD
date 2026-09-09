import type { MotivoCatalogItem } from '@/shared/types/motivo.types';

// ============================================================
// MOCK DATA — Catalogo de motivos (Tanda 9, ADR-010 seccion 5)
//
// Solo 'rechazo' sembrado y conectado a la UI en esta tanda
// (RegistrarEntregaModal) — ver la nota de alcance en motivo.types.ts.
// 'OTRO' es un item mas del catalogo, no un caso especial en el codigo
// que lo consume.
// ============================================================

export const MOTIVOS_MOCK_DATA: MotivoCatalogItem[] = [
  { codigo: 'MERCADERIA_DANADA', tipo: 'rechazo', descripcion: 'Mercadería dañada', activo: true, requiereEvidencia: true, disparaLogisticaInversa: true },
  { codigo: 'PRODUCTO_VENCIDO', tipo: 'rechazo', descripcion: 'Producto vencido o por vencer', activo: true, requiereEvidencia: true, disparaLogisticaInversa: true },
  { codigo: 'NO_CORRESPONDE_PEDIDO', tipo: 'rechazo', descripcion: 'No corresponde al pedido (producto/cantidad equivocada)', activo: true, requiereEvidencia: false, disparaLogisticaInversa: true },
  { codigo: 'EMPAQUE_VIOLADO', tipo: 'rechazo', descripcion: 'Empaque violado o abierto', activo: true, requiereEvidencia: true, disparaLogisticaInversa: true },
  { codigo: 'CLIENTE_CAMBIO_OPINION', tipo: 'rechazo', descripcion: 'El cliente ya no lo quiere (sin daño)', activo: true, requiereEvidencia: false, disparaLogisticaInversa: true },
  { codigo: 'ERROR_CARGA_YA_RESUELTO', tipo: 'rechazo', descripcion: 'Error de carga nuestro, ya resuelto en el momento', activo: true, requiereEvidencia: false, disparaLogisticaInversa: false },
  { codigo: 'OTRO', tipo: 'rechazo', descripcion: 'Otro (especificar)', activo: true, requiereEvidencia: false, disparaLogisticaInversa: true },
];
