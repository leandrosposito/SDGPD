import { defineConfig } from 'drizzle-kit'

// Solo generate. `drizzle-kit push` está prohibido (ADR-BE-001 §Decisión 3).
// Las tablas no llevan schema: el schema destino lo fija scripts/db/migrate.ts con search_path.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
})
