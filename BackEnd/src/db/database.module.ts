import { Global, Module } from '@nestjs/common'
import { Database } from './database.ts'

@Global()
@Module({ providers: [Database], exports: [Database] })
export class DatabaseModule {}
