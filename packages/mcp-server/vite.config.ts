import { builtinModules } from 'node:module';
import { join } from 'node:path';

import { defineConfig } from 'vite-plus';

/**
 * Only the node builtins stay external. The npm tarball carries this one file
 * and no node_modules, so every dependency, the engine and the MCP SDK
 * included, is inlined.
 */
const external = [
  ...builtinModules,
  ...builtinModules.map(name => `node:${name}`),
];

const sharedInput: Array<
  string | { auto: true } | { pattern: string; base: 'workspace' }
> = [
  { auto: true },
  'src/**',
  'vitest.config.*',
  'package.json',
  'vite.config.ts',
  'tsconfig.json',
  { pattern: 'tsconfig.app.json', base: 'workspace' },
  { pattern: 'packages/agent-hub/dist/**/*.d.ts', base: 'workspace' },
  { pattern: 'packages/erd-editor/dist/**/*.d.ts', base: 'workspace' },
  { pattern: 'packages/erd-editor-schema/dist/**/*.d.ts', base: 'workspace' },
  { pattern: 'packages/r-html/dist/**/*.d.ts', base: 'workspace' },
  '!**/*.tsbuildinfo',
];

export default defineConfig({
  // build.ssr alone externalizes anything resolved out of node_modules, which
  // would leave bare imports in a file that ships without node_modules.
  ssr: {
    noExternal: true,
  },

  resolve: {
    alias: {
      '@': join(import.meta.dirname, 'src'),
    },
  },

  build: {
    // ssr puts Rolldown in Node resolution mode: no browser field and no
    // import.meta.env shimming. node22 matches engines.node, the root floor.
    ssr: true,
    target: 'node22',
    outDir: 'dist',
    emptyOutDir: true,
    // npx downloads the tarball on every cold start, so it ships no map and
    // is minified: the engine and the SQL, GraphQL, DBML and AML parsers ride along.
    sourcemap: false,
    minify: true,
    // ESM: no consumer loads this file by require, and the ESM-only
    // dependencies inline without a format bridge.
    lib: {
      entry: './src/main.ts',
      formats: ['es'],
      fileName: () => 'erd-editor-mcp.js',
    },
    rolldownOptions: {
      external,
      output: {
        banner: '#!/usr/bin/env node',
        // An ssr build names the entry after its module and minifies without
        // stripping whitespace; these two say what the lib block above means.
        entryFileNames: 'erd-editor-mcp.js',
        minify: true,
      },
    },
  },

  /**
   * from lists all three fields because the workspace dependencies sit in
   * devDependencies here; the test task also builds this package first, since
   * bin.test.ts runs the built file.
   */
  run: {
    tasks: {
      build: {
        command: ['tsc --noEmit', 'vp build'],
        dependsOn: [
          {
            task: 'build',
            from: ['dependencies', 'devDependencies', 'peerDependencies'],
          },
        ],
        input: [...sharedInput, '!dist/**'],
        output: ['dist/**'],
      },
      test: {
        command: ['tsc --noEmit', 'vp test run'],
        dependsOn: [
          {
            task: 'build',
            from: ['dependencies', 'devDependencies', 'peerDependencies'],
          },
          'build',
        ],
        input: [...sharedInput],
      },
    },
  },
});
