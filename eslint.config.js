import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import importPlugin from 'eslint-plugin-import';
import { includeIgnoreFile } from '@eslint/compat';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const gitignorePath = path.resolve(__dirname, '.gitignore');

export default tseslint.config(includeIgnoreFile(gitignorePath), {
  extends: [
    js.configs.recommended,
    importPlugin.flatConfigs.recommended,
    ...tseslint.configs.recommended,
  ],
  files: ['**/src/**/*.{ts,tsx}'],
  languageOptions: {
    parserOptions: {
      project: ['./packages/*/tsconfig.json'],
      tsconfigRootDir: import.meta.dirname,
    },
    ecmaVersion: 2020,
    globals: globals.browser,
  },
  plugins: {
    'react-hooks': reactHooks,
    'react-refresh': reactRefresh,
    'simple-import-sort': simpleImportSort,
  },
  rules: {
    'simple-import-sort/imports': 'error',
    'simple-import-sort/exports': 'error',
    'import/first': 'error',
    'import/newline-after-import': 'error',
    'import/no-duplicates': 'error',
    'import/named': 'off',
    'import/namespace': 'off',
    'import/default': 'off',
    'import/no-named-as-default-member': 'off',
    'import/no-unresolved': 'off',
    ...reactHooks.configs.recommended.rules,
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    'require-yield': 'off',
    'no-useless-escape': 'off',
    'no-sparse-arrays': 'off',
    'no-unused-private-class-members': 'off',
    'no-case-declarations': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/ban-types': 'off',
    '@typescript-eslint/no-empty-interface': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-unused-expressions': 'off',
    '@typescript-eslint/no-empty-object-type': 'off',
    '@typescript-eslint/no-unsafe-function-type': 'off',
    '@typescript-eslint/no-require-imports': 'off',
  },
});
