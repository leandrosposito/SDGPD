import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module.ts'
import { ConfigError, loadConfig } from './config/config.ts'
import { configureApp } from './http/api-prefix.ts'

async function bootstrap(): Promise<void> {
  const config = loadConfig(process.env)
  const app = await NestFactory.create(AppModule.register(config))
  configureApp(app)
  app.enableShutdownHooks()
  await app.listen(config.port)
}

bootstrap().catch((err: unknown) => {
  console.error(err instanceof ConfigError ? err.message : err)
  process.exit(1)
})
