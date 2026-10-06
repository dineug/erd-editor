import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

/**
 * The source walker the import graph specs share. It reads files with node:fs,
 * so it runs under the node environment alone and the barrel never exports it:
 * a Chromium spec importing the barrel would fail to load node:fs.
 */
export const PACKAGE_ROOT = process.cwd();

export const SOURCE_ROOT = join(PACKAGE_ROOT, 'src');

/**
 * A static import or re-export with its type keyword, if any, the bindings it
 * names and its specifier; a bare side effect import; a dynamic import.
 */
export const IMPORT_FORM =
  /\b(import|export)\s+(type\s+)?([^;]*?)\bfrom\s*'([^']+)'|\bimport\s*'([^']+)'|\bimport\s*\(\s*'([^']+)'\s*\)/g;

/** The globals a Node realm lacks, read as a member access or named outright. */
export const DOM_TOKEN =
  /\b(document|window|navigator)\.|\b(SharedWorker|customElements)\b/g;

export const toSourcePath = (path: string, sourceRoot = SOURCE_ROOT) =>
  relative(sourceRoot, path).split(sep).join('/');

export function resolveSource(base: string): string {
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

export const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * Whether a file binds the name itself, as a parameter or a declaration, so a
 * member access on it is a local and not the global. The graphql importer
 * calls its AST parameter document, which the build renames on the way out.
 */
export const bindsLocally = (source: string, name: string) =>
  new RegExp(
    `[(,]\\s*${name}\\s*[:,)=]|\\b(?:const|let|var|function)\\s+${name}\\b`
  ).test(source);

export type Graph = {
  files: string[];
  bare: Map<string, string[]>;
  domTokens: string[];
};

/**
 * Walks the value imports from the entry through relative and @ specifiers. An
 * import type statement is skipped, while import with a type keyword inside its
 * braces counts as a value import, as a bundler that keeps the module would.
 */
export function walk(entry: string, sourceRoot = SOURCE_ROOT): Graph {
  const seen = new Set<string>();
  const bare = new Map<string, string[]>();
  const domTokens: string[] = [];
  const pending = [entry];
  const posix = (path: string) => toSourcePath(path, sourceRoot);

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
        pending.push(resolveSource(join(sourceRoot, specifier.slice(2))));
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
