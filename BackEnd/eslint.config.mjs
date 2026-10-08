// Config de lint única para BackEnd y packages/contracts (este último la usa con --config).
import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'drizzle/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // Solo la capa db/ habla con Postgres: el resto pasa por Database.withTenant (ADR-BE-002).
    files: ['src/**/*.ts'],
    ignores: ['src/db/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'pg', message: 'Solo src/db/ abre conexiones. Usá Database.withTenant.' },
            { name: 'drizzle-orm/node-postgres', message: 'Solo src/db/ arma el cliente. Usá Database.withTenant.' },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
)
