/// <reference types="vite/client" />
import { describe, expect, it } from 'vite-plus/test';

import ownSource from './node-free.test.ts?raw';

// Read through the bundler rather than node:fs, since this file is scanned
// too. A glob never matches the file that declares it, hence the raw import.
const sources: Record<string, string> = {
  ...import.meta.glob<string>('./**/*.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
  './node-free.test.ts': ownSource,
};

/**
 * The module an import, export, require or vi module call names. It is read in
 * a lookahead, so a typeof import in the call's type argument is read as well.
 */
const SPECIFIER =
  /\b(?:from|import|require|mock|doMock|unmock|doUnmock|importActual|importMock)\b(?=\s*(?:<[^>]*>)?\s*\(?\s*['"`]([^'"`]+)['"`])/g;

/**
 * Effect through the entries its package.json exports by name, as the root lint
 * rule has it: never a module path, and neither schema nor sql, where the rc
 * keeps SchemaAOTCompiler and Migrator. Platform-node is not a dependency here.
 */
const EFFECT_ENTRY =
  /^effect(?:\/testing|\/unstable\/(?!schema$|sql$)[a-z]+)?$/;

const isTestCode = (path: string) =>
  path.endsWith('.test.ts') || path.startsWith('./__test-utils__/');

const isEffect = (specifier: string) =>
  specifier === 'effect' ||
  specifier.startsWith('effect/') ||
  specifier.startsWith('@effect/');

const specifiers = (source: string) =>
  [...source.matchAll(SPECIFIER)].map(match => match[1]);

const nodeBuiltins = (source: string) =>
  specifiers(source).filter(specifier => specifier.startsWith('node:'));

describe('agent-hub stays free of node builtins', () => {
  it('scans every TypeScript file under src, tests included', () => {
    expect(Object.keys(sources)).toEqual(
      expect.arrayContaining([
        './discovery.ts',
        './framing.ts',
        './index.ts',
        './lock.ts',
        './paths.ts',
        './protocol.ts',
        './node-free.test.ts',
        './__test-utils__/effect.ts',
      ])
    );
  });

  it('has no node: import in any file', () => {
    const offenders = Object.entries(sources).flatMap(([path, source]) =>
      nodeBuiltins(source).map(specifier => `${path}: ${specifier}`)
    );

    expect(offenders).toEqual([]);
  });

  it('imports only its own modules and effect entries outside tests, so no bare builtin slips in either', () => {
    const bare = Object.entries(sources)
      .filter(([path]) => !isTestCode(path))
      .flatMap(([path, source]) =>
        specifiers(source)
          .filter(
            specifier =>
              !specifier.startsWith('./') &&
              !specifier.startsWith('@/') &&
              !EFFECT_ENTRY.test(specifier)
          )
          .map(specifier => `${path}: ${specifier}`)
      );

    expect(bare).toEqual([]);
  });

  it('imports effect from its entries in tests too, and does import it', () => {
    const effectImports = Object.entries(sources).flatMap(([path, source]) =>
      specifiers(source)
        .filter(isEffect)
        .map(specifier => ({ path, specifier }))
    );

    expect(effectImports.map(({ path }) => path)).toEqual(
      expect.arrayContaining(['./framing.ts', './discovery.test.ts'])
    );
    expect(
      effectImports
        .filter(({ specifier }) => !EFFECT_ENTRY.test(specifier))
        .map(({ path, specifier }) => `${path}: ${specifier}`)
    ).toEqual([]);
  });

  it('allows the documented effect entries only, never a module path', () => {
    for (const specifier of [
      'effect',
      'effect/testing',
      'effect/unstable/encoding',
    ]) {
      expect(EFFECT_ENTRY.test(specifier)).toBe(true);
    }
    // Spelled through a variable so a plain grep of src finds no module path here.
    const effect = 'effect';
    for (const specifier of [
      `${effect}/Schema`,
      `${effect}/testing/TestClock`,
      `${effect}/unstable/encoding/Ndjson`,
      `${effect}/unstable/schema`,
      `${effect}/unstable/sql`,
      'effect-schema',
      '@effect/platform-node',
    ]) {
      expect(EFFECT_ENTRY.test(specifier)).toBe(false);
    }
  });

  it('recognizes every import form it guards against', () => {
    // Spelled through variables so this file names no builtin or module path.
    const node = 'node';
    const effect = 'effect';
    const named = [
      `${node}:fs`,
      `${node}:net`,
      `${node}:os`,
      `${node}:path`,
      `${node}:path`,
      `${node}:url`,
      `${effect}/Option`,
      `${effect}/Effect`,
      `${effect}/Layer`,
      `${effect}/Scope`,
      `${effect}/Stream`,
      `${effect}/Schema`,
      `${effect}/testing/TestClock`,
    ];
    const statements = [
      `import { readFile } from '${named[0]}';`,
      `import '${named[1]}';`,
      `const os = await import("${named[2]}");`,
      `const path = require('${named[3]}');`,
      `export { join } from '${named[4]}';`,
      `const url = require(\`${named[5]}\`);`,
      `vi.mock('${named[6]}', () => ({}));`,
      `vi.doMock('${named[7]}', () => ({}));`,
      `vi.unmock('${named[8]}');`,
      `vi.doUnmock('${named[9]}');`,
      `await vi.importMock('${named[10]}');`,
      `await vi.importActual<typeof import('${named[12]}')>('${named[11]}');`,
    ];

    expect(specifiers(statements.join('\n'))).toEqual(named);
    expect(nodeBuiltins(statements.join('\n'))).toEqual(named.slice(0, 6));
    expect(nodeBuiltins(`import { node } from './node';`)).toEqual([]);
    expect(
      specifiers(`vi.mocked(console.error); importantly('./x'); remock('./y');`)
    ).toEqual([]);
    expect(
      specifiers(
        [
          `import { Schema } from 'effect';`,
          `import type { Stream } from "effect";`,
          `export * from 'effect/unstable/encoding';`,
          `const { Effect } = await import('effect');`,
        ].join('\n')
      )
    ).toEqual(['effect', 'effect', 'effect/unstable/encoding', 'effect']);
  });
});
