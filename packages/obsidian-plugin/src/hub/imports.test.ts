/// <reference types="vite/types/importMeta.d.ts" />
import { describe, expect, it } from 'vite-plus/test';

import { imports } from '@/__test-utils__/imports';

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

/** Obsidian, and the modules that reach it or the editor, which needs a window. */
const OBSIDIAN_ONLY =
  /\s(?:obsidian|@\/ErdView|@\/main|@\/loadErdEditor|@\/erdEditorModule)$/;

/** The entries effect's package.json names; platform-node by module path only. */
const EFFECT_ENTRY = /^effect(?:\/(?!index$|schema$|sql$)[a-z-]+)?$/;
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
    expect(runtimeImports.filter(line => OBSIDIAN_ONLY.test(line))).toEqual([]);
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
