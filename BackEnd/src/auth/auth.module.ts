import { Module } from '@nestjs/common'
import { APP_GUARD, DiscoveryModule } from '@nestjs/core'
import { AuthStore } from '../db/auth-store.ts'
import { AuthController } from './auth.controller.ts'
import { AuthGuard } from './auth.guard.ts'
import { AuthService } from './auth.service.ts'
import { DEFAULT_ROUTE_ALLOWLIST, ROUTE_ALLOWLIST } from './route-policy.ts'
import { RoutePolicyCheck } from './route-policy.check.ts'
import { TokenService } from './tokens.ts'

/**
 * Autenticación y permisos (ADR-BE-003; BE-1a): `/auth/*`, el guard global (AuthGuard, registrado
 * como APP_GUARD con useExisting para que un test pueda reemplazarlo con overrideProvider) y la
 * verificación de arranque de las políticas de ruta.
 */
@Module({
  imports: [DiscoveryModule],
  controllers: [AuthController],
  providers: [
    AuthStore,
    AuthService,
    TokenService,
    AuthGuard,
    { provide: APP_GUARD, useExisting: AuthGuard },
    { provide: ROUTE_ALLOWLIST, useValue: DEFAULT_ROUTE_ALLOWLIST },
    RoutePolicyCheck,
  ],
  exports: [AuthStore, TokenService],
})
export class AuthModule {}
