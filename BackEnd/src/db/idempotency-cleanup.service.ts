import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common'
import { Database } from './database.ts'

/** Cada cuánto se borran las claves vencidas. El TTL es de 48 h: con un barrido cada 15 min alcanza. */
export const IDEMPOTENCY_CLEANUP_INTERVAL_MS = 15 * 60 * 1000

/**
 * Scheduler dentro del proceso (ADR-BE-005, sub-decisión 8), sin cron externo. setInterval +
 * advisory lock de Postgres (Database.cleanupExpiredIdempotencyKeys): si hay varias instancias,
 * en cada vuelta limpia una sola.
 */
@Injectable()
export class IdempotencyCleanupService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('IdempotencyCleanup')
  private timer: NodeJS.Timeout | undefined

  constructor(private readonly database: Database) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.runOnce(), IDEMPOTENCY_CLEANUP_INTERVAL_MS)
    this.timer.unref()
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer)
  }

  /** Una vuelta de limpieza. Nunca tira: un fallo se registra y se reintenta en la próxima vuelta. */
  async runOnce(): Promise<number | null> {
    try {
      const deleted = await this.database.cleanupExpiredIdempotencyKeys()
      if (deleted !== null && deleted > 0) this.logger.log(`claves de idempotencia vencidas borradas: ${deleted}`)
      return deleted
    } catch (err) {
      this.logger.error(`la limpieza de idempotencia falló: ${err instanceof Error ? err.message : String(err)}`)
      return null
    }
  }
}
