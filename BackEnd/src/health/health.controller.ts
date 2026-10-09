import { Controller, Get } from '@nestjs/common'
import type { HealthResponse } from '@sdgpd/contracts'
import { Public } from '../auth/route-policy.ts'
import { Database } from '../db/database.ts'
import { ServiceUnavailableError } from '../http/errors.ts'

/** GET /health: endpoint operativo y público (BE-1a). Responde ok solo si la base contesta. */
@Controller('health')
export class HealthController {
  constructor(private readonly database: Database) {}

  @Get()
  @Public()
  async check(): Promise<HealthResponse> {
    try {
      await this.database.ping()
    } catch {
      throw new ServiceUnavailableError('La base de datos no responde')
    }
    return { status: 'ok', database: 'ok' }
  }
}
