/// <reference types="vite/types/importMeta.d.ts" />
import { describe, expect, it } from 'vite-plus/test';

// Read through the bundler, as mcp-server's import spec does. A glob never
// matches the file that declares it, so this spec is left out of its own scan.
const hubSources = import.meta.glob<string>('./*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const allSources = import.meta.glob<string>('../**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Every import or export statement with the module it names, type-only ones marked. */
const STATEMENT =
  /^\s*(import|export)\s+(type\s+)?[^'"]*?from\s+['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]/gm;

/** A require or a dynamic import of a literal module, which loads it at runtime all the same. */
const CALL = /\b(?:require|import)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function imports(source: string): Array<{ module: string; typeOnly: boolean }> {
  return [
    ...Array.from(source.matchAll(STATEMENT), match => ({
      module: match[3] ?? match[4],
      typeOnly: Boolean(match[2]),
    })),
    ...Array.from(source.matchAll(CALL), match => ({
      module: match[1],
      typeOnly: false,
    })),
  ];
}

/** The entries effect's package.json names; platform-node by module path only. */
const EFFECT_ENTRY =
  /^effect(?:\/testing|\/unstable\/(?!schema$|sql$)[a-z]+)?$/;
const PLATFORM_MODULE = /^@effect\/platform-node\/[A-Z]\w*$/;

const production = Object.entries(hubSources).filter(
  ([path]) => !path.endsWith('.test.ts')
);

describe('src/hub runs outside Obsidian', () => {
  it('scans every module of src/hub', () => {
    expect(production.map(([path]) => path)).toEqual(
      expect.arrayContaining([
        './handlers.ts',
        './registry.ts',
        './runtime.ts',
        './lifecycle.ts',
      ])
    );
  });

  it('reads a require and a dynamic import as runtime imports', () => {
    expect(
      imports(
        "const { Notice } = require('obsidian');\nconst view = await import('@/ErdView');"
      )
    ).toEqual([
      { module: 'obsidian', typeOnly: false },
      { module: '@/ErdView', typeOnly: false },
    ]);
  });

  it('takes nothing from obsidian at runtime, nor from the modules that do', () => {
    const runtimeImports = production.flatMap(([path, source]) =>
      imports(source)
        .filter(({ typeOnly }) => !typeOnly)
        .map(({ module }) => `${path} ${module}`)
    );

    expect(runtimeImports.length).toBeGreaterThan(0);
    expect(
      runtimeImports.filter(line =>
        /\s(?:obsidian|@\/ErdView|@\/main|@\/loadErdEditor)$/.test(line)
      )
    ).toEqual([]);
  });

  it('imports effect only from its documented entries, anywhere in src', () => {
    const effectImports = Object.entries(allSources).flatMap(([path, source]) =>
      imports(source)
        .map(({ module }) => module)
        .filter(module => module === 'effect' || /^@?effect\//.test(module))
        .map(module => ({ path, module }))
    );

    expect(effectImports.length).toBeGreaterThan(0);
    expect(
      effectImports.filter(
        ({ module }) =>
          !EFFECT_ENTRY.test(module) && !PLATFORM_MODULE.test(module)
      )
    ).toEqual([]);
  });
});
