import { type DynamicModule, Module } from '@nestjs/common'
import { AuthModule } from './auth/auth.module.ts'
import { APP_CONFIG, type AppConfig } from './config/config.ts'
import { DatabaseModule } from './db/database.module.ts'
import { HealthController } from './health/health.controller.ts'
import { CommandModule } from './http/command.module.ts'
import { HttpCoreModule } from './http/http.module.ts'
import { SettingsModule } from './settings/settings.module.ts'

@Module({})
export class AppModule {
  /** La configuración se valida antes (main.ts o el test) y entra ya tipada. */
  static register(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      global: true,
      imports: [DatabaseModule, HttpCoreModule, AuthModule, CommandModule, SettingsModule],
      controllers: [HealthController],
      providers: [{ provide: APP_CONFIG, useValue: config }],
      exports: [APP_CONFIG],
    }
  }
}
