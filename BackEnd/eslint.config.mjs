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
            { name: 'pg', message: 'Solo src/db/ abre conexiones. Usá Database.read() o un comando.' },
            { name: 'drizzle-orm/node-postgres', message: 'Solo src/db/ arma el cliente. Usá Database.read() o un comando.' },
          ],
        },
      ],
      // La transacción cruda (withTenant) escribe sin auditoría: fuera de src/db/ se usa read() o command().
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[property.name='withTenant']",
          message: 'withTenant es la transacción cruda: usá Database.read() o un comando (@Command()).',
        },
        // V2 de BE-0b: desde un builder de select() se llega por reflexión a la sesión de Drizzle y se
        // escribe sin auditoría. Fuera de src/db/ no se inspeccionan objetos ajenos por reflexión.
        {
          selector: "MemberExpression[property.name='session'], MemberExpression[property.value='session']",
          message: 'La sesión de Drizzle escribe sin auditoría: usá los helpers de CommandTx.',
        },
        {
          selector: "Identifier[name='Reflect'], MemberExpression[object.name='Object'][property.name=/^getOwnProperty/]",
          message: 'Sin reflexión fuera de src/db/: es la puerta para escribir sin auditoría (V2 de BE-0b).',
        },
      ],
    },
  },
  {
    files: ['**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
)
