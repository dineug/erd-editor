/// <reference types="vite/types/importMeta.d.ts" />
import { describe, expect, it } from 'vite-plus/test';

// Read through the bundler, as agent-hub's node-free spec does, with only the
// import.meta typings: vite/client brings DOM names this Node program lacks.
// A glob never matches the file that declares it, so the samples are skipped.
const sources = import.meta.glob<string>('./**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const SPECIFIER = /\b(?:from|import|require)\s*\(?\s*['"`]([^'"`]+)['"`]/g;
const ROOT_BARRELS = new Set(['effect', '@effect/platform-node']);

/** The rc keeps SchemaAOTCompiler and Migrator, each with a dynamic import, under these two. */
const DYNAMIC_IMPORT_MODULES = [
  'effect/unstable/schema',
  'effect/unstable/sql',
];

const reachesDynamicImport = (specifier: string) =>
  DYNAMIC_IMPORT_MODULES.some(
    module => specifier === module || specifier.startsWith(`${module}/`)
  );

/**
 * bin.test.ts forbids a literal dynamic import in the bundle, and the
 * platform-node root barrel reaches two, beside undici and ws. The effect root
 * goes with it: an import names the one module it needs, not all of them.
 */
function bannedImports(source: string): string[] {
  return [...source.matchAll(SPECIFIER)]
    .map(match => match[1])
    .filter(
      specifier =>
        ROOT_BARRELS.has(specifier) || reachesDynamicImport(specifier)
    );
}

describe('effect is imported by subpath only', () => {
  it('scans every TypeScript file under src but itself', () => {
    expect(Object.keys(sources)).toEqual(
      expect.arrayContaining([
        './main.ts',
        './session/live.ts',
        './tools/toolkit.ts',
        './__test-utils__/mcp.ts',
        './bin.test.ts',
      ])
    );
    expect(Object.keys(sources)).not.toContain('./imports.test.ts');
  });

  it('imports neither root barrel, nor the two modules that reach a dynamic import', () => {
    const offenders = Object.entries(sources).flatMap(([path, source]) =>
      bannedImports(source).map(specifier => `${path}: ${specifier}`)
    );

    expect(offenders).toEqual([]);
  });

  it('recognizes every import form it guards against', () => {
    // Spelled through the set so a plain grep of src finds no violation here.
    const [effect, platformNode] = ROOT_BARRELS;
    const sample = [
      `import { Effect } from '${effect}';`,
      `import type { Layer } from "${effect}";`,
      `import * as NodeRuntime from '${platformNode}';`,
      `export * from '${effect}';`,
      `const runtime = await import('${effect}');`,
    ].join('\n');

    expect(bannedImports(sample)).toEqual([
      effect,
      effect,
      platformNode,
      effect,
      effect,
    ]);
    const [schema, sql] = DYNAMIC_IMPORT_MODULES;
    expect(
      bannedImports(
        [
          `import * as Aot from '${schema}/SchemaAOTCompiler';`,
          `import * as Migrator from '${sql}/Migrator';`,
          `export * from '${schema}';`,
        ].join('\n')
      )
    ).toEqual([`${schema}/SchemaAOTCompiler`, `${sql}/Migrator`, schema]);
    expect(
      bannedImports(
        [
          `import * as Schema from 'effect/Schema';`,
          `import * as McpServer from 'effect/unstable/ai/McpServer';`,
          `import * as NodeStdio from '@effect/platform-node/NodeStdio';`,
          `import { effect } from './effect';`,
        ].join('\n')
      )
    ).toEqual([]);
  });
});
