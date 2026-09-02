import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      'no-restricted-imports': [
        'warn',
        {
          patterns: [
            {
              group: ['../../**'],
              message:
                "Use the '@/' alias instead of relative imports that go up more than one level (e.g. '@/shared/...' instead of '../../shared/...').",
            },
          ],
        },
      ],
      '@typescript-eslint/naming-convention': [
        'warn',
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
        {
          selector: 'function',
          format: ['camelCase', 'PascalCase'],
        },
      ],
      // Selectores de zustand estables (DECISIONES_TECNICAS.md, "Regla de
      // selectores estables"): un selector `use*Store(s => ...)` no debe
      // construir un array/objeto nuevo (ni via `.map`/`.filter`/spread ni
      // via `?? []`/`?? {}`), porque useSyncExternalStore compara el
      // snapshot por referencia y entra en loop ("getSnapshot should be
      // cached" / "Maximum update depth exceeded"). El selector solo debe
      // leer; toda derivacion va afuera, en el cuerpo del componente.
      'no-restricted-syntax': [
        'warn',
        {
          selector:
            "CallExpression[callee.name=/Store$/] > ArrowFunctionExpression ArrayExpression",
          message:
            'No construyas un array nuevo dentro de un selector de zustand (crea una referencia distinta en cada render). Selecciona el campo tal cual y arma el array afuera del selector.',
        },
        {
          selector:
            "CallExpression[callee.name=/Store$/] > ArrowFunctionExpression ObjectExpression",
          message:
            'No construyas un objeto nuevo dentro de un selector de zustand (crea una referencia distinta en cada render). Selecciona el campo tal cual y arma el objeto afuera del selector.',
        },
        {
          selector:
            "CallExpression[callee.name=/Store$/] > ArrowFunctionExpression CallExpression[callee.property.name=/^(map|filter|slice|concat|sort|reduce|flatMap)$/]",
          message:
            'No transformes datos con .map/.filter/etc. dentro de un selector de zustand (crea una referencia distinta en cada render). Selecciona el dato base y deriva afuera del selector (con useMemo si hace falta).',
        },
      ],
    },
  },
])
