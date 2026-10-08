import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'
import { ErrorFilter } from './error.filter.ts'
import { RequestIdMiddleware } from './request-id.middleware.ts'

/** Infraestructura HTTP transversal: filtro global de errores y X-Request-Id en toda ruta. */
@Module({ providers: [{ provide: APP_FILTER, useClass: ErrorFilter }] })
export class HttpCoreModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*path')
  }
}
