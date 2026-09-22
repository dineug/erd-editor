// @vitest-environment node

// AC-B5, source half: the peer entry runs in a Node process with no DOM and
// no bundler, so what it reaches must neither touch a browser global nor name
// a package the consumer's single file bundle cannot inline or resolve.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

const PACKAGE_ROOT = process.cwd();
const SOURCE_ROOT = join(PACKAGE_ROOT, 'src');
const ENTRY = join(SOURCE_ROOT, 'peer', 'index.ts');

/** The runtime dependencies the built engine chunks import, and no others. */
const BARE_ALLOWLIST = new Set([
  'deepmerge',
  'es-toolkit',
  'es-toolkit/compat',
  'graphql',
  'luxon',
  'nanoid',
  'rxjs',
]);

/**
 * A static import or re-export with its type keyword, if any, the bindings it
 * names and its specifier; a bare side effect import; a dynamic import.
 */
const IMPORT_FORM =
  /\b(import|export)\s+(type\s+)?([^;]*?)\bfrom\s*'([^']+)'|\bimport\s*'([^']+)'|\bimport\s*\(\s*'([^']+)'\s*\)/g;

/** The globals a Node realm lacks, read as a member access or named outright. */
const DOM_TOKEN =
  /\b(document|window|navigator)\.|\b(SharedWorker|customElements)\b/g;

const posix = (path: string) =>
  relative(SOURCE_ROOT, path).split(sep).join('/');

function resolveSource(base: string): string {
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ];
  const found = candidates.find(
    path => existsSync(path) && statSync(path).isFile()
  );
  if (!found) throw new Error(`Unresolved import: ${base}`);
  return found;
}

const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * Whether a file binds the name itself, as a parameter or a declaration, so a
 * member access on it is a local and not the global. The graphql importer
 * calls its AST parameter document, which the build renames on the way out.
 */
const bindsLocally = (source: string, name: string) =>
  new RegExp(
    `[(,]\\s*${name}\\s*[:,)=]|\\b(?:const|let|var|function)\\s+${name}\\b`
  ).test(source);

type Graph = {
  files: string[];
  bare: Map<string, string[]>;
  domTokens: string[];
};

/** Walks the value imports from the entry through relative and @ specifiers. */
function walk(entry: string): Graph {
  const seen = new Set<string>();
  const bare = new Map<string, string[]>();
  const domTokens: string[] = [];
  const pending = [entry];

  while (pending.length) {
    const file = pending.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);

    const source = stripComments(readFileSync(file, 'utf8'));

    for (const match of source.matchAll(IMPORT_FORM)) {
      const [, , typeOnly, bindings] = match;
      const specifier = match[4] ?? match[5] ?? match[6];
      if (typeOnly || (match[1] === 'export' && /^\s*type\b/.test(bindings))) {
        continue;
      }

      if (specifier.startsWith('@/')) {
        pending.push(resolveSource(join(SOURCE_ROOT, specifier.slice(2))));
      } else if (specifier.startsWith('.')) {
        pending.push(resolveSource(join(dirname(file), specifier)));
      } else {
        bare.set(specifier, [...(bare.get(specifier) ?? []), posix(file)]);
      }
    }

    for (const match of source.matchAll(DOM_TOKEN)) {
      const local = match[1] && bindsLocally(source, match[1]);
      if (!local) domTokens.push(`${posix(file)}: ${match[0]}`);
    }
  }

  return { files: [...seen].map(posix).sort(), bare, domTokens };
}

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

  it('names the three workspace libraries it inlines, none of them in dependencies', () => {
    const named = inlinedWorkspaceLibraries
      .filter(name => graph.bare.has(name))
      .sort();

    expect(named).toEqual([
      '@dineug/erd-editor-schema',
      '@dineug/r-html',
      '@dineug/schema-sql-parser',
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
