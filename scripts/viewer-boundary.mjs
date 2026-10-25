// Reads viewer-boundary.json for the gates that judge a built graph by it,
// pnpm dist-shape and pnpm consumer-bundles: its lists, the one match rule the
// file states, and where erd-editor's dist/ puts the libraries it inlines.
import fs from 'node:fs';
import path from 'node:path';

export const viewerBoundary = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, 'viewer-boundary.json'), 'utf8')
);

/**
 * The workspace libraries erd-editor's build inlines, each named @dineug/<folder>
 * and shipped under dist/<folder>/dist/ with no declarations.
 */
export const INLINED_LIBRARIES = [
  'erd-editor-schema',
  'grid',
  'r-html',
  'r-html-konva',
  'schema-sql-parser',
  'uuid',
];

/** Whether a module path or a package specifier matches an entry: equal, or below it past a slash or a dot. */
export const matchesEntry = (value, entry) =>
  value === entry ||
  value.startsWith(`${entry}/`) ||
  value.startsWith(`${entry}.`);

/** A file under erd-editor's dist/, given relative to it, as the module path the boundary file names. */
export const modulePathOf = relative =>
  relative.split(path.sep).join('/').replace(/\.[cm]?js$/, '');

const SCOPE = '@dineug/';

/** Where an inlined library's modules sit in erd-editor's dist/, as a module path; null for any other package. */
function inlinedPathOf(name) {
  const folder = name.startsWith(SCOPE) ? name.slice(SCOPE.length) : '';
  return INLINED_LIBRARIES.includes(folder) ? `${folder}/dist` : null;
}

/**
 * What a graph reaches that a rule forbids, one line each with the entry's why.
 * modules are module paths in erd-editor's dist/, packages the bare specifiers
 * or package module ids beside them; an inlined package is judged by its folder.
 */
export function forbiddenIn(
  { modules = [], packages = [] },
  { paths = [], packages: forbiddenPackages = [] }
) {
  const hits = [];
  for (const module of modules) {
    const entry = paths.find(({ path }) => matchesEntry(module, path));
    if (entry) {
      hits.push(`reaches ${module}: ${entry.path}, ${entry.why}`);
      continue;
    }
    const inlined = forbiddenPackages.find(({ name }) => {
      const folder = inlinedPathOf(name);
      return folder !== null && matchesEntry(module, folder);
    });
    if (inlined) hits.push(`reaches ${module}: ${inlined.name}, ${inlined.why}`);
  }
  for (const name of packages) {
    const entry = forbiddenPackages.find(forbidden =>
      matchesEntry(name, forbidden.name)
    );
    if (entry) hits.push(`reaches ${name}: ${entry.name}, ${entry.why}`);
  }
  return hits;
}
