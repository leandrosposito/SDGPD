import type { MotivoTipo } from '@sdgpd/contracts'

export type DefaultMotivo = {
  codigo: string
  tipo: MotivoTipo
  descripcion: string
  requiereEvidencia: boolean
  disparaLogisticaInversa: boolean
}

const m = (
  tipo: MotivoTipo,
  codigo: string,
  descripcion: string,
  requiereEvidencia: boolean,
  disparaLogisticaInversa: boolean,
): DefaultMotivo => ({ tipo, codigo, descripcion, requiereEvidencia, disparaLogisticaInversa })

/**
 * Catálogo inicial de cada empresa: los mismos 18 motivos del mock del frontend (`motivos.data.ts`).
 * Solo el rechazo dispara logística inversa (la mercadería vuelve del cliente); `OTRO` existe una vez por tipo.
 * Lo siembra `db:seed-dev`; el alta de empresas en producción es un pendiente sin tanda (BackEnd/docs/README.md).
 */
export const DEFAULT_MOTIVOS: readonly DefaultMotivo[] = [
  m('rechazo', 'MERCADERIA_DANADA', 'Mercadería dañada', true, true),
  m('rechazo', 'PRODUCTO_VENCIDO', 'Producto vencido o por vencer', true, true),
  m('rechazo', 'NO_CORRESPONDE_PEDIDO', 'No corresponde al pedido (producto/cantidad equivocada)', false, true),
  m('rechazo', 'EMPAQUE_VIOLADO', 'Empaque violado o abierto', true, true),
  m('rechazo', 'CLIENTE_CAMBIO_OPINION', 'El cliente ya no lo quiere (sin daño)', false, true),
  m('rechazo', 'ERROR_CARGA_YA_RESUELTO', 'Error de carga nuestro, ya resuelto en el momento', false, false),
  m('rechazo', 'OTRO', 'Otro (especificar)', false, true),
  m('reprogramacion', 'PEDIDO_CLIENTE', 'El cliente pidió otra fecha', false, false),
  m('reprogramacion', 'DESPERFECTO_VEHICULO', 'Desperfecto mecánico del vehículo', false, false),
  m('reprogramacion', 'RUTA_REPLANIFICADA', 'Ruta replanificada por el operador', false, false),
  m('reprogramacion', 'CLIMA', 'Condiciones climáticas', false, false),
  m('reprogramacion', 'OTRO', 'Otro (especificar)', false, false),
  m('no-entrega', 'CLIENTE_AUSENTE', 'Cliente ausente', false, false),
  m('no-entrega', 'NEGOCIO_CERRADO', 'Negocio cerrado en el horario acordado', true, false),
  m('no-entrega', 'DIRECCION_INCORRECTA', 'Dirección incorrecta o no encontrada', true, false),
  m('no-entrega', 'CLIENTE_RECHAZO_TOTAL', 'El cliente rechazó la entrega completa', false, false),
  m('no-entrega', 'ZONA_NO_ACCESIBLE', 'Zona de riesgo o sin acceso posible', false, false),
  m('no-entrega', 'OTRO', 'Otro (especificar)', false, false),
]
