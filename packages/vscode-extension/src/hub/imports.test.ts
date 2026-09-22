/// <reference types="vite/types/importMeta.d.ts" />
import { describe, expect, it } from 'vite-plus/test';

// All of src, not just the hub. Only the import.meta typings: vite/client
// needs DOM names this Node program lacks. A glob never matches the file that
// declares it, so the samples below are not scanned.
const sources = import.meta.glob<string>('../**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const SPECIFIER = /\b(?:from|import|require)\s*\(?\s*['"`]([^'"`]+)['"`]/g;
const ROOT_BARRELS = new Set(['effect', '@effect/platform-node']);

/**
 * The MCP server's rule, held here too: platform-node's root barrel reaches
 * undici, ws and redis, none of which the VSIX should carry, and effect's root
 * re-exports every core module. An import names the one module it needs.
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
        '../extension.ts',
        './index.ts',
        './server.ts',
        '../utils/index.ts',
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
      `import { Layer } from '${effect}';`,
      `import type { Scope } from "${effect}";`,
      `import * as NodeFileSystem from '${platformNode}';`,
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
          `import * as Layer from 'effect/Layer';`,
          `import * as Socket from 'effect/unstable/socket/Socket';`,
          `import * as NodePath from '@effect/platform-node/NodePath';`,
          `import { effect } from './effect';`,
        ].join('\n')
      )
    ).toEqual([]);
  });
});
