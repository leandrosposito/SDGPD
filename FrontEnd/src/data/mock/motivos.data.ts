import type { MotivoCatalogItem } from '@/shared/types/motivo.types';

// ============================================================
// MOCK DATA — Catalogo de motivos (Tanda 9, ADR-010 seccion 5;
// 'reprogramacion'/'no-entrega' sembrados en Tanda 11, ADR-013).
//
// 'OTRO' es un item mas de CADA catalogo (uno por tipo), no un caso
// especial en el codigo que lo consume.
//
// disparaLogisticaInversa en falso para TODO motivo de
// 'reprogramacion'/'no-entrega' (ADR-013): la mercaderia nunca sale
// del camion en ninguno de los dos casos (se reprograma antes de
// salir, o no se pudo bajar en la parada) — no hay nada "volviendo"
// del cliente que dispare el circuito de ADR-010 seccion 6, a
// diferencia de un rechazo real.
// ============================================================

export const MOTIVOS_MOCK_DATA: MotivoCatalogItem[] = [
  { codigo: 'MERCADERIA_DANADA', tipo: 'rechazo', descripcion: 'Mercadería dañada', activo: true, requiereEvidencia: true, disparaLogisticaInversa: true },
  { codigo: 'PRODUCTO_VENCIDO', tipo: 'rechazo', descripcion: 'Producto vencido o por vencer', activo: true, requiereEvidencia: true, disparaLogisticaInversa: true },
  { codigo: 'NO_CORRESPONDE_PEDIDO', tipo: 'rechazo', descripcion: 'No corresponde al pedido (producto/cantidad equivocada)', activo: true, requiereEvidencia: false, disparaLogisticaInversa: true },
  { codigo: 'EMPAQUE_VIOLADO', tipo: 'rechazo', descripcion: 'Empaque violado o abierto', activo: true, requiereEvidencia: true, disparaLogisticaInversa: true },
  { codigo: 'CLIENTE_CAMBIO_OPINION', tipo: 'rechazo', descripcion: 'El cliente ya no lo quiere (sin daño)', activo: true, requiereEvidencia: false, disparaLogisticaInversa: true },
  { codigo: 'ERROR_CARGA_YA_RESUELTO', tipo: 'rechazo', descripcion: 'Error de carga nuestro, ya resuelto en el momento', activo: true, requiereEvidencia: false, disparaLogisticaInversa: false },
  { codigo: 'OTRO', tipo: 'rechazo', descripcion: 'Otro (especificar)', activo: true, requiereEvidencia: false, disparaLogisticaInversa: true },

  { codigo: 'PEDIDO_CLIENTE', tipo: 'reprogramacion', descripcion: 'El cliente pidió otra fecha', activo: true, requiereEvidencia: false, disparaLogisticaInversa: false },
  { codigo: 'DESPERFECTO_VEHICULO', tipo: 'reprogramacion', descripcion: 'Desperfecto mecánico del vehículo', activo: true, requiereEvidencia: false, disparaLogisticaInversa: false },
  { codigo: 'RUTA_REPLANIFICADA', tipo: 'reprogramacion', descripcion: 'Ruta replanificada por el operador', activo: true, requiereEvidencia: false, disparaLogisticaInversa: false },
  { codigo: 'CLIMA', tipo: 'reprogramacion', descripcion: 'Condiciones climáticas', activo: true, requiereEvidencia: false, disparaLogisticaInversa: false },
  { codigo: 'OTRO', tipo: 'reprogramacion', descripcion: 'Otro (especificar)', activo: true, requiereEvidencia: false, disparaLogisticaInversa: false },

  { codigo: 'CLIENTE_AUSENTE', tipo: 'no-entrega', descripcion: 'Cliente ausente', activo: true, requiereEvidencia: false, disparaLogisticaInversa: false },
  { codigo: 'NEGOCIO_CERRADO', tipo: 'no-entrega', descripcion: 'Negocio cerrado en el horario acordado', activo: true, requiereEvidencia: true, disparaLogisticaInversa: false },
  { codigo: 'DIRECCION_INCORRECTA', tipo: 'no-entrega', descripcion: 'Dirección incorrecta o no encontrada', activo: true, requiereEvidencia: true, disparaLogisticaInversa: false },
  { codigo: 'CLIENTE_RECHAZO_TOTAL', tipo: 'no-entrega', descripcion: 'El cliente rechazó la entrega completa', activo: true, requiereEvidencia: false, disparaLogisticaInversa: false },
  { codigo: 'ZONA_NO_ACCESIBLE', tipo: 'no-entrega', descripcion: 'Zona de riesgo o sin acceso posible', activo: true, requiereEvidencia: false, disparaLogisticaInversa: false },
  { codigo: 'OTRO', tipo: 'no-entrega', descripcion: 'Otro (especificar)', activo: true, requiereEvidencia: false, disparaLogisticaInversa: false },
];
