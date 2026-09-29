// @ts-check
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

const DETERMINISM = 'The sim must be deterministic (VISION §5).';

// Anything that reads the outside world or varies across JS engines.
const simRestrictedGlobals = [
  'Date',
  'setTimeout',
  'setInterval',
  'setImmediate',
  'queueMicrotask',
  'requestAnimationFrame',
  'performance',
  'crypto',
  'process',
  'window',
  'document',
  'globalThis',
].map((name) => ({ name, message: DETERMINISM }));

// Transcendental Math results may differ between JS engines. Math.sqrt is exact (IEEE 754) and allowed.
const simRestrictedMath = [
  'random',
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'atan2',
  'sinh',
  'cosh',
  'tanh',
  'asinh',
  'acosh',
  'atanh',
  'exp',
  'expm1',
  'log',
  'log1p',
  'log2',
  'log10',
  'pow',
  'cbrt',
  'hypot',
].map((property) => ({ object: 'Math', property, message: DETERMINISM }));

export default defineConfig(
  globalIgnores(['**/node_modules/', '**/dist/', '**/coverage/']),
  {
    files: ['**/*.{js,ts}'],
    extends: [js.configs.recommended, tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ['packages/sim/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?!\\.{1,2}/)',
              message: 'packages/sim imports nothing outside itself (VISION §5).',
            },
          ],
        },
      ],
      'no-restricted-globals': ['error', ...simRestrictedGlobals],
      'no-restricted-properties': ['error', ...simRestrictedMath],
      'no-restricted-syntax': [
        'error',
        { selector: ':function[async=true]', message: `No async in the sim. ${DETERMINISM}` },
        { selector: 'ClassDeclaration, ClassExpression', message: 'Sim state is plain data; use types and functions.' },
        { selector: "BinaryExpression[operator='**']", message: `Use integer multiplication. ${DETERMINISM}` },
        { selector: 'Literal[raw=/^[0-9]*\\.[0-9]/]', message: 'Integers only: use milli-tiles, ticks or basis points.' },
      ],
    },
  },
  {
    files: ['packages/sim/test/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?!(\\.{1,2}/|vitest$))',
              message: 'Sim tests import only the sim and vitest.',
            },
          ],
        },
      ],
    },
  },
);
