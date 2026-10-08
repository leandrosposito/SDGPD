import { Controller, Get } from '@nestjs/common'
import type { HealthResponse } from '@sdgpd/contracts'
import { Database } from '../db/database.ts'
import { ServiceUnavailableError } from '../http/errors.ts'

/** GET /health: endpoint operativo, el único de BE-0a. Responde ok solo si la base contesta. */
@Controller('health')
export class HealthController {
  constructor(private readonly database: Database) {}

  @Get()
  async check(): Promise<HealthResponse> {
    try {
      await this.database.ping()
    } catch {
      throw new ServiceUnavailableError('La base de datos no responde')
    }
    return { status: 'ok', database: 'ok' }
  }
}
