import { Global, Module } from '@nestjs/common'
import { Database } from './database.ts'
import { IdempotencyCleanupService } from './idempotency-cleanup.service.ts'

@Global()
@Module({ providers: [Database, IdempotencyCleanupService], exports: [Database, IdempotencyCleanupService] })
export class DatabaseModule {}
