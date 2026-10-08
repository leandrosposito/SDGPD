// Tests de packages/contracts. Las herramientas las declara BackEnd (la consigna de BE-0a
// autoriza en contracts solo zod y typescript); contracts las invoca con --config.
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  root: fileURLToPath(new URL('../packages/contracts', import.meta.url)),
  test: { include: ['test/**/*.test.ts'] },
})
