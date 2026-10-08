import { existsSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

// Node 24 lee .env sin dotenv. No pisa variables ya definidas en el entorno.
if (existsSync('.env')) process.loadEnvFile('.env')

export default defineConfig({
  // Los tests usan las fuentes de contracts, igual que el typecheck (no hace falta compilarlo antes).
  // 'module', 'node' y 'development|production' son las condiciones por defecto de Vite para el servidor
  // (defaultServerConditions); se escriben acá para no importar vite, que no es dependencia directa.
  ssr: { resolve: { conditions: ['sdgpd-source', 'module', 'node', 'development|production'] } },
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/setup/guard.ts'],
    // La base es remota (Supabase): un archivo a la vez y pools chicos.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
