// Every value the peer entry exports has a user here. The entry is the one seam
// onto the engine, so a key nobody imports is dead public surface and this spec
// is what holds erd-editor's export list to the names in use.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import * as peer from '@dineug/erd-editor/peer.js';
import { describe, expect, it } from 'vite-plus/test';

const SOURCE_ROOT = join(process.cwd(), 'src');
const SELF = 'peerSurface.test.ts';

/** A named import from the peer entry, with the type keyword it may carry. */
const PEER_IMPORT =
  /import\s+(type\s+)?\{([^}]*)\}\s*from\s*'@dineug\/erd-editor\/peer\.js'/g;

const posix = (path: string) =>
  relative(SOURCE_ROOT, path).split(sep).join('/');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [posix(path)] : [];
  });
}

/**
 * The names a source binds as values, aliases resolved to the exported one. A
 * type-only import proves nothing about a value, so the type forms are dropped.
 */
function valuesImported(source: string): string[] {
  return [...source.matchAll(PEER_IMPORT)].flatMap(match =>
    match[1]
      ? []
      : match[2]
          .split(',')
          .map(specifier => specifier.trim())
          .filter(specifier => specifier && !/^type\s/.test(specifier))
          .map(specifier => specifier.split(/\s+as\s+/)[0].trim())
  );
}

describe('the peer entry has no dead export', () => {
  const files = sourceFiles(SOURCE_ROOT);
  // This spec's own sample imports name real exports, so counting them would
  // keep a key alive that nothing else uses.
  const imported = new Set(
    files
      .filter(file => file !== SELF)
      .flatMap(file =>
        valuesImported(readFileSync(join(SOURCE_ROOT, file), 'utf8'))
      )
  );

  it('reads the whole package source, specs included, this spec aside', () => {
    expect(files.length).toBeGreaterThan(50);
    expect(files).toEqual(
      expect.arrayContaining([
        'tools/run.ts',
        'tools/registry/table.ts',
        'tools/registry.kind.test.ts',
        SELF,
      ])
    );
  });

  it('imports every one of the entry’s exported values somewhere', () => {
    const keys = Object.keys(peer).sort();

    expect(keys).toHaveLength(46);
    expect(keys.filter(key => !imported.has(key))).toEqual([]);
  });

  it('binds no name the entry does not export', () => {
    const exported = new Set(Object.keys(peer));

    expect([...imported].filter(name => !exported.has(name)).sort()).toEqual(
      []
    );
  });

  it('reads the import forms it scans, and skips the type-only ones', () => {
    const sample = [
      "import { createPeerStore, type PeerStore } from '@dineug/erd-editor/peer.js';",
      "import type { RootState } from '@dineug/erd-editor/peer.js';",
      "import { bHas as hasBit } from '@dineug/erd-editor/peer.js';",
    ].join('\n');

    expect(valuesImported(sample).sort()).toEqual(['bHas', 'createPeerStore']);
  });
});
