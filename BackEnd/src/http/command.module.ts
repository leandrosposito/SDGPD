import { Module } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { CommandInterceptor } from './command.interceptor.ts'

/** Toda mutación es un comando transaccional, y todo POST es idempotente (CommandInterceptor). */
@Module({ providers: [{ provide: APP_INTERCEPTOR, useClass: CommandInterceptor }] })
export class CommandModule {}
