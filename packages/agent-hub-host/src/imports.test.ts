/// <reference types="vite/types/importMeta.d.ts" />
import { describe, expect, it } from 'vite-plus/test';

// Read through the bundler, as mcp-server's guard does, with only the
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

/** The builtins the hub runs on; a host adds nothing here, so no editor API can leak in. */
const NODE_BUILTIN = /^node:(?:net|fs|fs\/promises|os|crypto|path)$/;

const AGENT_HUB = '@dineug/erd-editor-agent-hub';

const isTestCode = (path: string) =>
  path.endsWith('.test.ts') || path.startsWith('./__test-utils__/');

const isEffect = (specifier: string) =>
  specifier === 'effect' ||
  specifier.startsWith('effect/') ||
  specifier.startsWith('@effect/');

const specifiers = (source: string) =>
  [...source.matchAll(SPECIFIER)].map(match => match[1]);

function misplacedImports(source: string): string[] {
  return specifiers(source)
    .filter(isEffect)
    .filter(
      specifier =>
        !EFFECT_ENTRY.test(specifier) && !PLATFORM_MODULE.test(specifier)
    );
}

/** What shipping code imports beyond its own modules and the allowed packages. */
function foreignImports(source: string): string[] {
  return specifiers(source).filter(
    specifier =>
      !specifier.startsWith('./') &&
      !specifier.startsWith('@/') &&
      !NODE_BUILTIN.test(specifier) &&
      !EFFECT_ENTRY.test(specifier) &&
      !PLATFORM_MODULE.test(specifier) &&
      specifier !== AGENT_HUB
  );
}

describe('the host side imports only the hub and node', () => {
  it('scans every TypeScript file under src but itself', () => {
    expect(Object.keys(sources)).toEqual(
      expect.arrayContaining([
        './index.ts',
        './server.ts',
        './services/DocumentHub.ts',
        './services/netSocket.ts',
        './__test-utils__/hubLayers.ts',
        './server.test.ts',
      ])
    );
    expect(Object.keys(sources)).not.toContain('./imports.test.ts');
  });

  it('reads the imports this package has, so the checks below are not vacuous', () => {
    const seen = new Set(
      Object.entries(sources)
        .filter(([path]) => !isTestCode(path))
        .flatMap(([, source]) => specifiers(source))
    );

    expect([...seen]).toEqual(
      expect.arrayContaining([
        'effect',
        'effect/unstable/socket',
        '@effect/platform-node/NodeFileSystem',
        'node:net',
        'node:fs',
        AGENT_HUB,
      ])
    );
  });

  it('ships no import but its own modules, node builtins, effect and agent-hub', () => {
    const offenders = Object.entries(sources)
      .filter(([path]) => !isTestCode(path))
      .flatMap(([path, source]) =>
        foreignImports(source).map(specifier => `${path}: ${specifier}`)
      );

    expect(offenders).toEqual([]);
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
    const platformNode = '@effect/platform-node';
    const refusedEffect = [
      `${effect}/Effect`,
      `${effect}/unstable/socket/Socket`,
      `${effect}/unstable/schema`,
      platformNode,
      `${platformNode}/NodeFileSystem/extra`,
      `${platformNode}-shared/NodeFileSystem`,
    ];
    const hosts = ['vscode', 'obsidian'];
    const refusedForeign = [
      ...hosts,
      'node:child_process',
      'fs',
      '@dineug/erd-editor-agent-hub-host',
      '@dineug/erd-editor-webview-bridge',
      ...refusedEffect,
    ];
    const statements = refusedForeign.map(
      (specifier, index) =>
        [
          `import * as host from '${specifier}';`,
          `import type { App } from "${specifier}";`,
          `export * from '${specifier}';`,
          `const loaded = await import('${specifier}');`,
          `const required = require('${specifier}');`,
        ][index % 5]
    );

    expect(misplacedImports(statements.join('\n'))).toEqual(refusedEffect);
    expect(foreignImports(statements.join('\n'))).toEqual(refusedForeign);
    expect(
      foreignImports(
        [
          `import * as net from 'node:net';`,
          `import { unlinkSync } from 'node:fs';`,
          `import { lstat } from 'node:fs/promises';`,
          `import { homedir } from 'node:os';`,
          `import { randomUUID } from 'node:crypto';`,
          `import { posix } from 'node:path';`,
          `import { Effect } from 'effect';`,
          `import { Socket } from 'effect/unstable/socket';`,
          `import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem';`,
          `import { HubRequestError } from '@dineug/erd-editor-agent-hub';`,
          `import { serveConnection } from '@/server';`,
          `export { layer } from './lockFile';`,
        ].join('\n')
      )
    ).toEqual([]);
  });
});
