import { Module } from '@nestjs/common'
import { DriversController } from './drivers.controller.ts'
import { MotivosController } from './motivos.controller.ts'
import { SuppliersController } from './suppliers.controller.ts'
import { VehiclesController } from './vehicles.controller.ts'

/** Maestros sin dependencias de negocio (BE-2): proveedores, vehículos, choferes y motivos. */
@Module({ controllers: [SuppliersController, VehiclesController, DriversController, MotivosController] })
export class MastersModule {}
