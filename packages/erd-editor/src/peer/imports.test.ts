// @vitest-environment node

// AC-B5, source half: the peer entry runs in a Node process with no DOM and
// no bundler, so what it reaches must neither touch a browser global nor name
// a package the consumer's single file bundle cannot inline or resolve.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

import {
  bindsLocally,
  IMPORT_FORM,
  PACKAGE_ROOT,
  resolveSource,
  SOURCE_ROOT,
  walk,
} from '@/__test-utils__/importGraph';

const ENTRY = join(SOURCE_ROOT, 'peer', 'index.ts');

/** The runtime dependencies the built engine chunks import, and no others. */
const BARE_ALLOWLIST = new Set([
  'deepmerge',
  'es-toolkit',
  'es-toolkit/compat',
  'graphql',
  'luxon',
  'rxjs',
]);

const manifest = JSON.parse(
  readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')
);

/** The private workspace libraries, which the build inlines rather than imports. */
const inlinedWorkspaceLibraries = Object.entries(
  manifest.devDependencies as Record<string, string>
)
  .filter(([, version]) => version.startsWith('workspace:'))
  .map(([name]) => name);

describe('peer source graph (AC-B5)', () => {
  const graph = walk(ENTRY);

  it('starts at the peer entry and reaches the stores and plumbing it wraps', () => {
    expect(graph.files).toEqual(
      expect.arrayContaining([
        'peer/index.ts',
        'engine/peer-store.ts',
        'engine/rx-store.ts',
        'engine/shared-store.ts',
        'engine/presence.ts',
        'engine/stream-flush.ts',
        'engine/to-width.ts',
        'utils/schema-sql/index.ts',
      ])
    );
  });

  it('reaches nothing of the element or the replication store', () => {
    expect(graph.files.filter(file => file.startsWith('components/'))).toEqual(
      []
    );
    expect(graph.files).not.toContain('index.ts');
    expect(graph.files).not.toContain('engine/index.ts');
    expect(graph.files).not.toContain('engine/replication-store.ts');
  });

  it('touches no browser global', () => {
    expect(graph.domTokens).toEqual([]);
  });

  it('names only allowlisted packages or workspace libraries the build inlines', () => {
    const allowed = new Set([...BARE_ALLOWLIST, ...inlinedWorkspaceLibraries]);
    const offenders = [...graph.bare.entries()]
      .filter(([specifier]) => !allowed.has(specifier))
      .map(([specifier, files]) => `${specifier} <- ${files.join(', ')}`);

    expect(offenders).toEqual([]);
  });

  it('names the four workspace libraries it inlines, none of them in dependencies', () => {
    const named = inlinedWorkspaceLibraries
      .filter(name => graph.bare.has(name))
      .sort();

    expect(named).toEqual([
      '@dineug/erd-editor-schema',
      '@dineug/r-html',
      '@dineug/schema-sql-parser',
      '@dineug/uuid',
    ]);
    for (const name of named) {
      expect(manifest.dependencies?.[name]).toBeUndefined();
    }
  });

  it('reaches no konva module, shiki, elkjs or worker spawn', () => {
    const banned = [...graph.bare.keys()].filter(specifier =>
      /^(konva|shiki|@shikijs|elkjs|comlink)(\/|$)/.test(specifier)
    );

    expect(banned).toEqual([]);
    expect(graph.files.filter(file => file.startsWith('workers/'))).toEqual([]);
  });
});

describe('the scan itself', () => {
  it('reports a global member access and ignores a bound parameter', () => {
    expect(bindsLocally('function f(document: Node) {}', 'document')).toBe(
      true
    );
    expect(bindsLocally('const window = {};', 'window')).toBe(true);
    expect(bindsLocally('document.body.append(x);', 'document')).toBe(false);
  });

  it('skips type-only imports and follows value ones', () => {
    const forms = [
      ...`import type { A } from './a';
export type { B } from './b';
import { c } from './c';
export { d } from './d';
import './e';
await import('./f');`.matchAll(IMPORT_FORM),
    ].map(match => ({
      typeOnly: Boolean(
        match[2] || (match[1] === 'export' && /^\s*type\b/.test(match[3]))
      ),
      specifier: match[4] ?? match[5] ?? match[6],
    }));

    expect(forms).toEqual([
      { typeOnly: true, specifier: './a' },
      { typeOnly: true, specifier: './b' },
      { typeOnly: false, specifier: './c' },
      { typeOnly: false, specifier: './d' },
      { typeOnly: false, specifier: './e' },
      { typeOnly: false, specifier: './f' },
    ]);
  });

  it('fails loudly on an import it cannot resolve', () => {
    expect(() => resolveSource(join(SOURCE_ROOT, 'peer', 'missing'))).toThrow(
      'Unresolved import'
    );
  });
});
