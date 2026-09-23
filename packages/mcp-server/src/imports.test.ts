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

/**
 * The module an import, export, require or vi module call names. It is read in
 * a lookahead, so a typeof import in the call's type argument is read as well.
 */
const SPECIFIER =
  /\b(?:from|import|require|mock|doMock|unmock|doUnmock|importActual|importMock)\b(?=\s*(?:<[^>]*>)?\s*\(?\s*['"`]([^'"`]+)['"`])/g;

/**
 * The entries effect's package.json exports by name, which its own docs import
 * from; a module path resolves only through the wildcard. The rc keeps
 * SchemaAOTCompiler and Migrator, each with a dynamic import, in schema and sql.
 */
const EFFECT_ENTRY =
  /^effect(?:\/testing|\/unstable\/(?!schema$|sql$)[a-z]+)?$/;

/** Platform-node's barrel re-exports NodeRedis, whose redis this workspace does not install. */
const PLATFORM_MODULE = /^@effect\/platform-node\/[A-Z]\w*$/;

const isEffect = (specifier: string) =>
  specifier === 'effect' ||
  specifier.startsWith('effect/') ||
  specifier.startsWith('@effect/');

const effectSpecifiers = (source: string) =>
  [...source.matchAll(SPECIFIER)].map(match => match[1]).filter(isEffect);

function misplacedImports(source: string): string[] {
  return effectSpecifiers(source).filter(
    specifier =>
      !EFFECT_ENTRY.test(specifier) && !PLATFORM_MODULE.test(specifier)
  );
}

describe('effect is imported from its documented entries', () => {
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

  it('reads the effect imports this package has, so the check below is not vacuous', () => {
    const seen = new Set(Object.values(sources).flatMap(effectSpecifiers));

    expect([...seen]).toEqual(
      expect.arrayContaining([
        'effect',
        'effect/testing',
        'effect/unstable/ai',
        'effect/unstable/socket',
        '@effect/platform-node/NodeRuntime',
        '@effect/platform-node/NodeStdio',
      ])
    );
  });

  it('names no module path of effect, no platform-node barrel, and neither schema nor sql', () => {
    const offenders = Object.entries(sources).flatMap(([path, source]) =>
      misplacedImports(source).map(specifier => `${path}: ${specifier}`)
    );

    expect(offenders).toEqual([]);
  });

  it('recognizes every form it guards against', () => {
    // Spelled through variables so a plain grep of src finds no module path here.
    const effect = 'effect';
    const unstable = `${effect}/unstable`;
    const platformNode = '@effect/platform-node';
    const refused = [
      `${effect}/Effect`,
      `${effect}/Schema`,
      `${effect}/testing/TestClock`,
      `${unstable}/ai/McpServer`,
      `${unstable}/socket/Socket`,
      `${unstable}/schema`,
      `${unstable}/sql`,
      `${unstable}/schema/SchemaAOTCompiler`,
      platformNode,
      `${platformNode}/NodeStdio/extra`,
      `${platformNode}-shared/NodeSocket`,
      `${effect}/Option`,
      `${effect}/Layer`,
      `${effect}/Scope`,
      `${effect}/Stream`,
      `${effect}/Clock`,
      `${effect}/Cause`,
    ];
    const statements = [
      `import { Effect } from '${refused[0]}';`,
      `import type { Top } from "${refused[1]}";`,
      `import * as TestClock from '${refused[2]}';`,
      `export * from '${refused[3]}';`,
      `const socket = await import('${refused[4]}');`,
      `import '${refused[5]}';`,
      `const sql = require('${refused[6]}');`,
      `export { make } from '${refused[7]}';`,
      `vi.mock('${refused[8]}', () => ({}));`,
      `import { layer } from '${refused[9]}';`,
      `import * as NodeSocket from '${refused[10]}';`,
      `vi.doMock('${refused[11]}', () => ({}));`,
      `vi.unmock(\`${refused[12]}\`);`,
      `vi.doUnmock('${refused[13]}');`,
      `await vi.importMock('${refused[14]}');`,
      `await vi.importActual<typeof import('${refused[16]}')>('${refused[15]}');`,
    ];

    expect(misplacedImports(statements.join('\n'))).toEqual(refused);
    expect(
      misplacedImports(
        [
          `import { Effect, Layer } from 'effect';`,
          `import type { Cause } from 'effect';`,
          `import { TestClock } from 'effect/testing';`,
          `import { McpServer } from 'effect/unstable/ai';`,
          `import { Socket } from 'effect/unstable/socket';`,
          `import { Ndjson } from 'effect/unstable/encoding';`,
          `import * as NodeStdio from '@effect/platform-node/NodeStdio';`,
          `vi.mock('@effect/platform-node/NodeRuntime', () => ({}));`,
          `await vi.importActual<typeof import('effect')>('effect');`,
          `import { effect } from './effect';`,
          `import { effectful } from 'effectful';`,
        ].join('\n')
      )
    ).toEqual([]);
  });
});
