import { Module } from '@nestjs/common'
import { BranchesController } from './branches.controller.ts'
import { RolesController } from './roles.controller.ts'
import { UsersController } from './users.controller.ts'

/** Usuarios, roles y sucursales (módulo `settings` de la matriz; BE-1a). */
@Module({ controllers: [UsersController, RolesController, BranchesController] })
export class SettingsModule {}
