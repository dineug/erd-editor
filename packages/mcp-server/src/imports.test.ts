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

/**
 * bin.test.ts forbids a literal dynamic import in the bundle, and the
 * platform-node root barrel reaches two, beside undici and ws. The effect root
 * goes with it: an import names the one module it needs, not all of them.
 */
function rootBarrelImports(source: string): string[] {
  return [...source.matchAll(SPECIFIER)]
    .map(match => match[1])
    .filter(specifier => ROOT_BARRELS.has(specifier));
}

describe('effect is imported by subpath only', () => {
  it('scans every TypeScript file under src but itself', () => {
    expect(Object.keys(sources)).toEqual(
      expect.arrayContaining([
        './main.ts',
        './session/live.ts',
        './tools/register.ts',
        './__test-utils__/mcp.ts',
        './bin.test.ts',
      ])
    );
    expect(Object.keys(sources)).not.toContain('./imports.test.ts');
  });

  it('imports neither effect nor @effect/platform-node by its bare name', () => {
    const offenders = Object.entries(sources).flatMap(([path, source]) =>
      rootBarrelImports(source).map(specifier => `${path}: ${specifier}`)
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

    expect(rootBarrelImports(sample)).toEqual([
      effect,
      effect,
      platformNode,
      effect,
      effect,
    ]);
    expect(
      rootBarrelImports(
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
