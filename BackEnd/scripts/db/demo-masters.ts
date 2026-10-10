// Maestros de la empresa demo del seed de desarrollo (BE-2): proveedores, vehículos, choferes y motivos
// del mock del frontend, con ids FIJOS. Son los MISMOS ids que usa el mock (FrontEnd/src/data/mock/
// {suppliers,vehicles,drivers,motivos}.data.ts y los datos que los referencian: productos, órdenes de
// compra, viajes), así un módulo que va por http y otro que sigue en mock hablan de las mismas entidades.
// Solo constantes, sin dependencias: lo importan scripts/db/seed-dev.ts, los tests y la verificación del
// frontend (scripts/verificacion/v19-ids-maestros.mjs), que compara los dos lados. No son secretos.
//
// Esquema de los ids: 0192f00N-0000-7000-8000-<12 dígitos>, con N = 1 proveedores, 2 vehículos,
// 3 choferes, 4 motivos (las sucursales de BE-1b usan N = 0).

/** Proveedor inexistente a propósito (regla O9 del frontend): un id de proveedor que NO está en el seed. */
export const DEMO_MISSING_SUPPLIER_ID = '0192f001-0000-7000-8000-000000000999'

export type DemoSupplier = {
  id: string
  name: string
  cuit: string
  phone: string
  contactName: string
  contactEmail: string
  address: string
  city: string
  paymentTerms: string
  category: string
}

export const DEMO_SUPPLIERS: readonly DemoSupplier[] = [
  {
    id: '0192f001-0000-7000-8000-000000000001',
    name: 'Molinos Canuelas S.A.',
    cuit: '30-54321678-9',
    phone: '+54 11 4800-1200',
    contactName: 'Ricardo Leiva',
    contactEmail: 'r.leiva@molinoscanuela.com.ar',
    address: 'Av. Corrientes 4521, Piso 8',
    city: 'Buenos Aires',
    paymentTerms: '30 dias',
    category: 'Alimentos Secos',
  },
  {
    id: '0192f001-0000-7000-8000-000000000002',
    name: 'Las Marias S.A.C.I.',
    cuit: '30-67891234-5',
    phone: '+54 3756 42-5000',
    contactName: 'Claudia Rios',
    contactEmail: 'c.rios@lasmarias.com.ar',
    address: 'Ruta Provincial 5, Km 12',
    city: 'Apostoles, Misiones',
    paymentTerms: '60 dias',
    category: 'Infusiones',
  },
  {
    id: '0192f001-0000-7000-8000-000000000003',
    name: 'Arcor S.A.I.C.',
    cuit: '30-50456789-1',
    phone: '+54 11 5555-8000',
    contactName: 'Marcelo Torres',
    contactEmail: 'm.torres@arcor.com.ar',
    address: 'Av. del Libertador 7208',
    city: 'Buenos Aires',
    paymentTerms: '15 dias',
    category: 'Golosinas',
  },
]

export type DemoVehicle = {
  id: string
  patente: string
  tipo: string
  capacidad: { bultos: number; pesoKg: number; volumenM3: number; refrigerado: boolean; zonasHabilitadas: string[] }
}

export const DEMO_VEHICLES: readonly DemoVehicle[] = [
  {
    id: '0192f002-0000-7000-8000-000000000001',
    patente: 'AB123CD',
    tipo: 'Camioneta',
    capacidad: { bultos: 80, pesoKg: 1200, volumenM3: 6, refrigerado: false, zonasHabilitadas: ['Norte', 'Centro', 'Sur'] },
  },
  {
    id: '0192f002-0000-7000-8000-000000000002',
    patente: 'AC456EF',
    tipo: 'Camion refrigerado',
    capacidad: { bultos: 60, pesoKg: 2000, volumenM3: 10, refrigerado: true, zonasHabilitadas: ['Norte', 'Centro', 'Sur'] },
  },
  {
    id: '0192f002-0000-7000-8000-000000000003',
    patente: 'AD789GH',
    tipo: 'Camion',
    capacidad: { bultos: 150, pesoKg: 4000, volumenM3: 18, refrigerado: false, zonasHabilitadas: ['Norte', 'Centro', 'Sur'] },
  },
  {
    id: '0192f002-0000-7000-8000-000000000004',
    patente: 'AE012IJ',
    tipo: 'Utilitario',
    capacidad: { bultos: 35, pesoKg: 500, volumenM3: 3, refrigerado: false, zonasHabilitadas: ['Centro'] },
  },
]

export type DemoDriver = { id: string; nombre: string; licencia: string; telefono: string }

export const DEMO_DRIVERS: readonly DemoDriver[] = [
  { id: '0192f003-0000-7000-8000-000000000001', nombre: 'Carlos Fernandez', licencia: 'B-1234567', telefono: '+54 11 5551-0001' },
  { id: '0192f003-0000-7000-8000-000000000002', nombre: 'Marina Gomez', licencia: 'B-2345678', telefono: '+54 11 5551-0002' },
  { id: '0192f003-0000-7000-8000-000000000003', nombre: 'Julian Ibarra', licencia: 'C-3456789', telefono: '+54 11 5551-0003' },
]

export type DemoMotivo = {
  id: string
  codigo: string
  tipo: 'rechazo' | 'reprogramacion' | 'no-entrega'
  descripcion: string
  requiereEvidencia: boolean
  disparaLogisticaInversa: boolean
}

const motivoId = (n: number) => `0192f004-0000-7000-8000-${String(n).padStart(12, '0')}`

export const DEMO_MOTIVOS: readonly DemoMotivo[] = [
  { id: motivoId(1), codigo: 'MERCADERIA_DANADA', tipo: 'rechazo', descripcion: 'Mercadería dañada', requiereEvidencia: true, disparaLogisticaInversa: true },
  { id: motivoId(2), codigo: 'PRODUCTO_VENCIDO', tipo: 'rechazo', descripcion: 'Producto vencido o por vencer', requiereEvidencia: true, disparaLogisticaInversa: true },
  {
    id: motivoId(3),
    codigo: 'NO_CORRESPONDE_PEDIDO',
    tipo: 'rechazo',
    descripcion: 'No corresponde al pedido (producto/cantidad equivocada)',
    requiereEvidencia: false,
    disparaLogisticaInversa: true,
  },
  { id: motivoId(4), codigo: 'EMPAQUE_VIOLADO', tipo: 'rechazo', descripcion: 'Empaque violado o abierto', requiereEvidencia: true, disparaLogisticaInversa: true },
  {
    id: motivoId(5),
    codigo: 'CLIENTE_CAMBIO_OPINION',
    tipo: 'rechazo',
    descripcion: 'El cliente ya no lo quiere (sin daño)',
    requiereEvidencia: false,
    disparaLogisticaInversa: true,
  },
  {
    id: motivoId(6),
    codigo: 'ERROR_CARGA_YA_RESUELTO',
    tipo: 'rechazo',
    descripcion: 'Error de carga nuestro, ya resuelto en el momento',
    requiereEvidencia: false,
    disparaLogisticaInversa: false,
  },
  { id: motivoId(7), codigo: 'OTRO', tipo: 'rechazo', descripcion: 'Otro (especificar)', requiereEvidencia: false, disparaLogisticaInversa: true },
  { id: motivoId(8), codigo: 'PEDIDO_CLIENTE', tipo: 'reprogramacion', descripcion: 'El cliente pidió otra fecha', requiereEvidencia: false, disparaLogisticaInversa: false },
  {
    id: motivoId(9),
    codigo: 'DESPERFECTO_VEHICULO',
    tipo: 'reprogramacion',
    descripcion: 'Desperfecto mecánico del vehículo',
    requiereEvidencia: false,
    disparaLogisticaInversa: false,
  },
  {
    id: motivoId(10),
    codigo: 'RUTA_REPLANIFICADA',
    tipo: 'reprogramacion',
    descripcion: 'Ruta replanificada por el operador',
    requiereEvidencia: false,
    disparaLogisticaInversa: false,
  },
  { id: motivoId(11), codigo: 'CLIMA', tipo: 'reprogramacion', descripcion: 'Condiciones climáticas', requiereEvidencia: false, disparaLogisticaInversa: false },
  { id: motivoId(12), codigo: 'OTRO', tipo: 'reprogramacion', descripcion: 'Otro (especificar)', requiereEvidencia: false, disparaLogisticaInversa: false },
  { id: motivoId(13), codigo: 'CLIENTE_AUSENTE', tipo: 'no-entrega', descripcion: 'Cliente ausente', requiereEvidencia: false, disparaLogisticaInversa: false },
  {
    id: motivoId(14),
    codigo: 'NEGOCIO_CERRADO',
    tipo: 'no-entrega',
    descripcion: 'Negocio cerrado en el horario acordado',
    requiereEvidencia: true,
    disparaLogisticaInversa: false,
  },
  {
    id: motivoId(15),
    codigo: 'DIRECCION_INCORRECTA',
    tipo: 'no-entrega',
    descripcion: 'Dirección incorrecta o no encontrada',
    requiereEvidencia: true,
    disparaLogisticaInversa: false,
  },
  {
    id: motivoId(16),
    codigo: 'CLIENTE_RECHAZO_TOTAL',
    tipo: 'no-entrega',
    descripcion: 'El cliente rechazó la entrega completa',
    requiereEvidencia: false,
    disparaLogisticaInversa: false,
  },
  {
    id: motivoId(17),
    codigo: 'ZONA_NO_ACCESIBLE',
    tipo: 'no-entrega',
    descripcion: 'Zona de riesgo o sin acceso posible',
    requiereEvidencia: false,
    disparaLogisticaInversa: false,
  },
  { id: motivoId(18), codigo: 'OTRO', tipo: 'no-entrega', descripcion: 'Otro (especificar)', requiereEvidencia: false, disparaLogisticaInversa: false },
]
