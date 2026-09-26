/// <reference types="vite/types/importMeta.d.ts" />
import { describe, expect, it } from 'vite-plus/test';

// All of src and test, whose mocks the src-scoped lint rule misses. Only the
// import.meta typings: vite/client needs DOM names this Node program lacks. A
// glob never matches the file that declares it, so the samples are skipped.
const sources = import.meta.glob<string>(['../**/*.ts', '../../test/**/*.ts'], {
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
 * The MCP server's rule, held here too: effect through the entries its
 * package.json exports by name, never a module path, and schema and sql not
 * at all, since the rc keeps SchemaAOTCompiler and Migrator there.
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
  it('scans every TypeScript file under src and test but itself', () => {
    expect(Object.keys(sources)).toEqual(
      expect.arrayContaining([
        '../extension.ts',
        './index.ts',
        './vscodeHost.ts',
        '../utils/index.ts',
        '../../test/mocks/hubLayers.ts',
        '../../test/integration/agent-hub.test.ts',
      ])
    );
    expect(Object.keys(sources)).not.toContain('./imports.test.ts');
  });

  it('reads the effect imports this package has, so the check below is not vacuous', () => {
    const seen = new Set(Object.values(sources).flatMap(effectSpecifiers));

    expect([...seen]).toEqual(
      expect.arrayContaining(['effect', 'effect/unstable/socket'])
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
      `${effect}/Layer`,
      `${effect}/Scope`,
      `${effect}/testing/TestClock`,
      `${unstable}/socket/Socket`,
      `${unstable}/schema`,
      `${unstable}/sql/Migrator`,
      platformNode,
      `${platformNode}/NodePath/extra`,
      `${platformNode}-shared/NodeFileSystem`,
      `${effect}/Option`,
      `${effect}/Effect`,
      `${effect}/Stream`,
      `${effect}/Clock`,
      `${effect}/Cause`,
      `${effect}/Exit`,
    ];
    const statements = [
      `import { Layer } from '${refused[0]}';`,
      `import type * as Scope from "${refused[1]}";`,
      `export * from '${refused[2]}';`,
      `const socket = await import('${refused[3]}');`,
      `import '${refused[4]}';`,
      `const sql = require('${refused[5]}');`,
      `vi.mock('${refused[6]}', () => ({}));`,
      `import { layer } from '${refused[7]}';`,
      `export { layer } from '${refused[8]}';`,
      `vi.doMock('${refused[9]}', () => ({}));`,
      `vi.unmock(\`${refused[10]}\`);`,
      `vi.doUnmock('${refused[11]}');`,
      `await vi.importMock('${refused[12]}');`,
      `await vi.importActual<typeof import('${refused[14]}')>('${refused[13]}');`,
    ];

    expect(misplacedImports(statements.join('\n'))).toEqual(refused);
    expect(
      misplacedImports(
        [
          `import { Effect, Layer, ManagedRuntime } from 'effect';`,
          `import type { PlatformError } from 'effect';`,
          `import { Socket } from 'effect/unstable/socket';`,
          `import { TestClock } from 'effect/testing';`,
          `import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem';`,
          `const { Effect } = await import('effect');`,
          `await vi.importActual<typeof import('effect')>('effect');`,
          `import { effect } from './effect';`,
          `import { effectful } from 'effectful';`,
        ].join('\n')
      )
    ).toEqual([]);
  });
});
