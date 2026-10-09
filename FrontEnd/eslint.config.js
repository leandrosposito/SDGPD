import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// Selectores de zustand estables (DECISIONES_TECNICAS.md, "Regla de
// selectores estables"): un selector `use*Store(s => ...)` no debe
// construir un array/objeto nuevo (ni via `.map`/`.filter`/spread ni
// via `?? []`/`?? {}`), porque useSyncExternalStore compara el
// snapshot por referencia y entra en loop ("getSnapshot should be
// cached" / "Maximum update depth exceeded"). El selector solo debe
// leer; toda derivacion va afuera, en el cuerpo del componente.
const ZUSTAND_SELECTOR_RULES = [
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
]

// IDs branded (ADR-006, enmienda 2026-10-09, Tanda 22): `x as <Tipo>Id`
// fuera de ids.types.ts saltea la validacion de formato del constructor.
// Valor externo (URL, storage, respuesta sin validar) -> is<Tipo>Id;
// valor confiable -> as<Tipo>Id(). Cubre `x as OrderId` y
// `x as OrderId | undefined`.
const BRANDED_ID_CAST_MESSAGE =
  "Prohibido 'as <Tipo>Id' fuera de ids.types.ts (ADR-006). Usá is<Tipo>Id para valores externos o as<Tipo>Id() para confiables."
const BRANDED_ID_CAST_RULES = [
  {
    selector: 'TSAsExpression > TSTypeReference.typeAnnotation[typeName.name=/Id$/]',
    message: BRANDED_ID_CAST_MESSAGE,
  },
  {
    selector: 'TSAsExpression > TSUnionType.typeAnnotation > TSTypeReference[typeName.name=/Id$/]',
    message: BRANDED_ID_CAST_MESSAGE,
  },
]

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
      // Una sola declaracion para las dos familias: flat config no fusiona
      // las opciones de una misma regla entre bloques (el ultimo gana).
      // Severidad 'error' desde la Tanda 22 (antes 'warn', solo zustand).
      'no-restricted-syntax': ['error', ...ZUSTAND_SELECTOR_RULES, ...BRANDED_ID_CAST_RULES],
    },
  },
  {
    // Unico archivo donde `as <Tipo>Id` es legitimo: dentro de cada
    // constructor as<Tipo>Id, despues de validar el formato.
    files: ['src/shared/types/ids.types.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...ZUSTAND_SELECTOR_RULES],
    },
  },
])
