import { defineConfig } from 'vite-plus';

export default defineConfig({
  /**
   * Replaces the root `lint-staged` field. `vp check --fix` is fmt -> lint --fix
   * -> fmt in one pass. The glob is the one lint-staged used, `.mts` included.
   * No type gate here — there was none before either; that lives in CI and in
   * each package's `build` and `test` tasks.
   */
  staged: {
    '**/*.{ts,mts,tsx}': 'vp check --fix',
  },
  lint: {
    plugins: ['oxc', 'typescript', 'react'],
    categories: {
      correctness: 'warn',
    },
    env: {
      builtin: true,
    },
    ignorePatterns: [
      '**/.DS_Store',
      '**/node_modules',
      '**/dist',
      '**/coverage',
      '**/docs',
      '**/storybook-static',
      'docker/**/data',
      '**/types',
      '**/.turbo',
      '**/*.vsix',
      '**/build',
      '**/.docusaurus',
      '**/.cache-loader',
      '**/.gradle',
      '**/.intellijPlatform',
      '**/.kotlin',
      '**/.qodana',
      'packages/vscode-extension/public',
      'packages/vscode-extension/out',
      'packages/vscode-extension/.vscode-test',
      'packages/intellij-plugin/src/main/resources/assets',
      '**/npm-debug.log*',
      '**/yarn-debug.log*',
      '**/yarn-error.log*',
      '**/.idea',
      '.vscode/*',
      '!.vscode/launch.json',
      '!.vscode/tasks.json',
      '**/*.suo',
      '**/*.ntvs*',
      '**/*.njsproj',
      '**/*.sln',
      '**/*.sw?',
      '**/.nx',
      '**/.omc',
      '**/.playwright-mcp',
      '**/test-results',
      '**/playwright-report',
      '**/blob-report',
      'packages/*/e2e/.results',
      'packages/*/e2e/.report',
    ],
    overrides: [
      {
        files: ['**/src/**/*.{ts,tsx}'],
        rules: {
          'constructor-super': 'off',
          'for-direction': 'error',
          'getter-return': 'off',
          'no-async-promise-executor': 'error',
          'no-case-declarations': 'off',
          'no-class-assign': 'off',
          'no-compare-neg-zero': 'error',
          'no-cond-assign': 'error',
          'no-const-assign': 'off',
          'no-constant-binary-expression': 'error',
          'no-constant-condition': 'error',
          'no-control-regex': 'error',
          'no-debugger': 'error',
          'no-delete-var': 'error',
          'no-dupe-class-members': 'off',
          'no-dupe-else-if': 'error',
          'no-dupe-keys': 'off',
          'no-duplicate-case': 'error',
          'no-empty': 'error',
          'no-empty-character-class': 'error',
          'no-empty-pattern': 'error',
          'no-empty-static-block': 'error',
          'no-ex-assign': 'error',
          'no-extra-boolean-cast': 'error',
          'no-fallthrough': 'error',
          'no-func-assign': 'off',
          'no-global-assign': 'error',
          'no-import-assign': 'off',
          'no-invalid-regexp': 'error',
          'no-irregular-whitespace': 'error',
          'no-loss-of-precision': 'error',
          'no-misleading-character-class': 'error',
          'no-new-native-nonconstructor': 'off',
          'no-nonoctal-decimal-escape': 'error',
          'no-obj-calls': 'off',
          'no-prototype-builtins': 'error',
          'no-redeclare': 'off',
          'no-regex-spaces': 'error',
          'no-self-assign': 'error',
          'no-setter-return': 'off',
          'no-shadow-restricted-names': 'error',
          'no-sparse-arrays': 'off',
          'no-this-before-super': 'off',
          'no-undef': 'off',
          'no-unexpected-multiline': 'error',
          'no-unreachable': 'off',
          'no-unsafe-finally': 'error',
          'no-unsafe-negation': 'off',
          'no-unsafe-optional-chaining': 'error',
          'no-unused-labels': 'error',
          'no-unused-private-class-members': 'off',
          'no-unused-vars': 'off',
          'no-useless-backreference': 'error',
          'no-useless-catch': 'error',
          'no-useless-escape': 'off',
          'no-with': 'error',
          'require-yield': 'off',
          'use-isnan': 'error',
          'valid-typeof': 'error',
          'import/named': 'off',
          'import/namespace': 'off',
          'import/default': 'off',
          'import/export': 'error',
          'import/no-named-as-default': 'warn',
          'import/no-named-as-default-member': 'off',
          'import/no-duplicates': 'error',
          'no-var': 'error',
          'prefer-const': 'error',
          'prefer-rest-params': 'error',
          'prefer-spread': 'error',
          'no-array-constructor': 'error',
          'no-unused-expressions': 'off',
          'typescript/ban-ts-comment': 'off',
          'typescript/no-duplicate-enum-values': 'error',
          'typescript/no-empty-object-type': 'off',
          'typescript/no-explicit-any': 'off',
          'typescript/no-extra-non-null-assertion': 'error',
          'typescript/no-misused-new': 'error',
          'typescript/no-namespace': 'error',
          'typescript/no-non-null-asserted-optional-chain': 'error',
          'typescript/no-require-imports': 'off',
          'typescript/no-this-alias': 'error',
          'typescript/no-unnecessary-type-constraint': 'error',
          'typescript/no-unsafe-declaration-merging': 'error',
          'typescript/no-unsafe-function-type': 'off',
          'typescript/no-wrapper-object-types': 'error',
          'typescript/prefer-as-const': 'error',
          'typescript/prefer-namespace-keyword': 'error',
          'typescript/triple-slash-reference': 'error',
          'simple-import-sort/imports': 'error',
          'simple-import-sort/exports': 'error',
          'import/first': 'error',
          'import/newline-after-import': 'error',
          'no-empty-function': 'off',
          'react/rules-of-hooks': 'error',
          'react/exhaustive-deps': 'warn',
          'react/only-export-components': [
            'warn',
            {
              allowConstantExport: true,
            },
          ],
          'typescript/explicit-module-boundary-types': 'off',
          'typescript/ban-types': 'off',
          'typescript/no-empty-interface': 'off',
        },
        plugins: ['import'],
        env: {
          browser: true,
          es2018: true,
          es2020: true,
        },
        jsPlugins: ['eslint-plugin-simple-import-sort'],
      },
      {
        /**
         * `erd-editor`'s `.tsx` is JSX, not React: it compiles to r-html tagged
         * templates. Scoped rather than global because `app` is React 19, where
         * these rules mean what they say.
         */
        files: ['packages/erd-editor/src/**/*.tsx'],
        rules: {
          // There is no `key` prop to add. List identity is the `repeat()`
          // directive's job, and it takes the key function as its second
          // argument.
          'react/jsx-key': 'off',
          // `children` is an ordinary prop of type `DOMTemplateLiterals` here,
          // and forwarding one is not the same as nesting it: `<C>{t}</C>`
          // compiles to `.children=${html`${t}`}`, a second template around the
          // one you already had.
          'react/no-children-prop': 'off',
          // Reports a file as un-refreshable on React's boundary rule, which is
          // not r-html's: `rHtml()` accepts any export whose name starts with a
          // capital, so `export const Cursor = {…} as const` keeps the file a
          // boundary while this rule calls it broken.
          'react/only-export-components': 'off',
        },
      },
      {
        /**
         * The JSX contract has to be a `namespace` — that is the shape
         * `jsxImportSource` looks for — and it has to be a `.ts` rather than a
         * `.d.ts`, because `vite-plugin-dts` emits declarations and does not
         * copy hand-written ones.
         */
        files: ['packages/r-html/src/jsx-runtime.ts'],
        rules: {
          'typescript/no-namespace': 'off',
        },
      },
    ],
    /**
     * Type-aware lint is off. tsgolint targets TypeScript 7 and reads this repo
     * differently from the compiler that actually gates it: turned on today it
     * reports errors in `.storybook/preview.ts`, the vscode-extension specs and
     * the integration suite, none of which `tsc --noEmit` flags. Two checkers
     * disagreeing is worse than one that agrees, and the type gate keeps its
     * existing home — `tsc --noEmit`, per package.
     *
     * Turning this on is its own track: it needs the tsgolint/tsc gap closed
     * first, and that is what buys the single-pass `vp check` this migration
     * otherwise leaves on the table.
     */
    options: {
      typeAware: false,
      typeCheck: false,
    },
    jsPlugins: [
      {
        name: 'vite-plus',
        specifier: 'vite-plus/oxlint-plugin',
      },
    ],
    rules: {
      'vite-plus/prefer-vite-plus-imports': 'error',
    },
  },
  fmt: {
    trailingComma: 'es5',
    arrowParens: 'avoid',
    endOfLine: 'lf',
    singleQuote: true,
    semi: true,
    bracketSpacing: true,
    tabWidth: 2,
    printWidth: 80,
    sortPackageJson: false,
    /**
     * Formatting scope is exactly what it was before the migration: the previous
     * `format:prettier` script passed `**\/*.{ts,mts,tsx}` and nothing else.
     * oxfmt handles seventeen languages, so leaving this empty silently widens
     * the scope to 82 files — Markdown, HTML, JSON, JS and the webpack configs.
     *
     * Markdown matters most. The fifteen AGENTS.md files are hand-maintained
     * prose that the repo treats as canonical; one unscoped `vp fmt` rewrites
     * hundreds of lines of them, and that is not a style accident.
     *
     * Widening this is a separate decision, not a side effect of changing
     * formatters. Witness: `git status --short` lists no AGENTS.md after
     * `vp fmt`.
     */
    ignorePatterns: [
      // Everything oxfmt handles that Prettier was never pointed at. A deny
      // list rather than `['**/*', '!**/*.ts', …]`, because oxfmt does not
      // re-include after a global exclude — that spelling matches zero files
      // and reports success.
      '**/*.md',
      '**/*.mdx',
      '**/*.html',
      '**/*.css',
      '**/*.scss',
      '**/*.json',
      '**/*.jsonc',
      '**/*.json5',
      '**/*.yaml',
      '**/*.yml',
      '**/*.js',
      '**/*.cjs',
      '**/*.mjs',
      '**/*.jsx',
      '**/*.vue',
      '**/*.svelte',
      '**/*.astro',
      '**/*.graphql',
      '**/*.toml',
      // Build output and reports, which no formatter should walk into.
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/storybook-static/**',
      '**/test-results/**',
      'packages/*/e2e/.report/**',
      'packages/vscode-extension/out/**',
      'packages/vscode-extension/public/**',
      'packages/vscode-extension/.vscode-test/**',
      'packages/intellij-plugin/src/main/resources/assets/**',
    ],
  },
});
