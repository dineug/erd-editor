// konva is reached through konva/lib entry points and never through the package
// root, and a sibling package by its name and exports alone. The barrel pulls
// every shape, filter and DOM binding into every consumer's build.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

const PACKAGE_ROOT = process.cwd();

const SOURCE_ROOT = join(PACKAGE_ROOT, 'src');

const PACKAGES_ROOT = join(PACKAGE_ROOT, '..');

/**
 * The module specifier of a static import, a re-export or a dynamic import. The
 * keyword prefix is what keeps the allowlists below from matching themselves.
 */
const SPECIFIER = /(?:\bfrom|\bimport)\s*\(?\s*'([^']+)'/g;

const KONVA_ROOT = 'konva';

const WORKSPACE_SCOPE = '@dineug/';

/**
 * What a file that ships may name: the Stage the grid constructs for its
 * canvas. Every layer and shape inside it comes from a k-* tag, which the host
 * package constructs.
 */
const RUNTIME_MODULES = new Set(['konva/lib/Stage']);

/**
 * More a shipped file may name by type alone: the context and the shape a
 * scene function is handed, and the layer it marks dirty. Nothing here
 * constructs one, and the spec below holds each to an import type.
 */
const TYPE_ONLY_MODULES = new Set([
  'konva/lib/Context',
  'konva/lib/Layer',
  'konva/lib/Shape',
]);

/** A static import with its type keyword, if it carries one, and its specifier. */
const IMPORT_FORM = /\bimport\s+(type\s+)?[^;]*?\bfrom\s*'([^']+)'/g;

/** One more a spec may name: the namespace that holds the pixel ratio konva read at load. */
const SPEC_ONLY_MODULES = new Set(['konva/lib/Global']);

const isSpec = (file: string) => /\.test\.tsx?$/.test(file);

function sourceFiles(directory: string, found: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      sourceFiles(path, found);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      found.push(path);
    }
  }

  return found;
}

const posix = (path: string) =>
  relative(SOURCE_ROOT, path).split(sep).join('/');

type Reference = { file: string; path: string; specifier: string };

function references(): Reference[] {
  const found: Reference[] = [];

  for (const path of sourceFiles(SOURCE_ROOT)) {
    const source = readFileSync(path, 'utf8');

    for (const [, specifier] of source.matchAll(SPECIFIER)) {
      found.push({ file: posix(path), path, specifier });
    }
  }

  return found;
}

const konvaReferences = () =>
  references().filter(
    ({ specifier }) =>
      specifier === KONVA_ROOT || specifier.startsWith(`${KONVA_ROOT}/`)
  );

const offenders = (allowed: Set<string>, scope: (file: string) => boolean) =>
  konvaReferences()
    .filter(({ file, specifier }) => scope(file) && !allowed.has(specifier))
    .map(({ file, specifier }) => `${file}: ${specifier}`)
    .sort();

/** Each workspace package's name, with the subpaths its exports map opens. */
function workspaceExports(): Map<string, Set<string>> {
  const packages = new Map<string, Set<string>>();

  for (const entry of readdirSync(PACKAGES_ROOT, { withFileTypes: true })) {
    const manifestPath = join(PACKAGES_ROOT, entry.name, 'package.json');
    if (!entry.isDirectory() || !existsSync(manifestPath)) continue;

    const manifest: { name: string; exports?: Record<string, unknown> } =
      JSON.parse(readFileSync(manifestPath, 'utf8'));
    packages.set(manifest.name, new Set(Object.keys(manifest.exports ?? {})));
  }

  return packages;
}

/** The package a specifier names and the exports key it asks for. */
function splitWorkspaceSpecifier(specifier: string) {
  const [scope, name, ...rest] = specifier.split('/');

  return {
    name: `${scope}/${name}`,
    subpath: rest.length ? `./${rest.join('/')}` : '.',
  };
}

describe('konva enters this package through konva/lib only', () => {
  it('imports the package root nowhere', () => {
    const barrel = konvaReferences().filter(
      ({ specifier }) => specifier === KONVA_ROOT
    );

    expect(barrel).toEqual([]);
  });

  it('names only the module the grid constructs, or types', () => {
    const allowed = new Set([...RUNTIME_MODULES, ...TYPE_ONLY_MODULES]);

    expect(offenders(allowed, file => !isSpec(file))).toEqual([]);
  });

  it('names the scene function types by type alone', () => {
    const valued: string[] = [];

    for (const path of sourceFiles(SOURCE_ROOT)) {
      const source = readFileSync(path, 'utf8');

      for (const [, type, specifier] of source.matchAll(IMPORT_FORM)) {
        if (TYPE_ONLY_MODULES.has(specifier) && !type) {
          valued.push(`${posix(path)}: ${specifier}`);
        }
      }
    }

    expect(valued).toEqual([]);
  });

  it('lets a spec add the pixel ratio namespace, and no more', () => {
    const allowed = new Set([
      ...RUNTIME_MODULES,
      ...TYPE_ONLY_MODULES,
      ...SPEC_ONLY_MODULES,
    ]);

    expect(offenders(allowed, isSpec)).toEqual([]);
  });

  it('keeps the spec-only module out of what ships', () => {
    const shipped = konvaReferences()
      .filter(({ file }) => !isSpec(file))
      .map(({ specifier }) => specifier);

    for (const module of SPEC_ONLY_MODULES) {
      expect(shipped).not.toContain(module);
    }
  });
});

describe('a sibling package is reached by its name alone', () => {
  it('never reaches out of src through a relative path', () => {
    const escaping = references()
      .filter(({ specifier }) => specifier.startsWith('.'))
      .filter(({ path, specifier }) => {
        const target = relative(SOURCE_ROOT, resolve(dirname(path), specifier));

        return target.startsWith('..') || isAbsolute(target);
      })
      .map(({ file, specifier }) => `${file}: ${specifier}`);

    expect(escaping).toEqual([]);
  });

  it('names only a subpath the sibling exports, never its src or dist', () => {
    const packages = workspaceExports();
    const unexported = references()
      .filter(({ specifier }) => specifier.startsWith(WORKSPACE_SCOPE))
      .filter(({ specifier }) => {
        const { name, subpath } = splitWorkspaceSpecifier(specifier);

        return !packages.get(name)?.has(subpath);
      })
      .map(({ file, specifier }) => `${file}: ${specifier}`);

    expect(unexported).toEqual([]);
  });

  it('reads the exports of the siblings this package depends on', () => {
    const packages = workspaceExports();

    expect(packages.get('@dineug/r-html')).toEqual(
      new Set(['.', './jsx-runtime'])
    );
    expect(packages.get('@dineug/r-html-konva')).toEqual(new Set(['.']));
    expect(splitWorkspaceSpecifier('@dineug/r-html/jsx-runtime')).toEqual({
      name: '@dineug/r-html',
      subpath: './jsx-runtime',
    });
  });
});

it('scanned the package sources, specs and the scene included', () => {
  const files = sourceFiles(SOURCE_ROOT).map(posix);
  const specifiers = references().map(({ specifier }) => specifier);

  expect(files).toEqual(
    expect.arrayContaining([
      'index.ts',
      'theme.ts',
      'imports.test.ts',
      'scene/GridScene.tsx',
      'scene/paint.ts',
      'scene/GridScene.browser.test.tsx',
    ])
  );
  expect(specifiers).toEqual(
    expect.arrayContaining([
      '@/theme',
      '@dineug/r-html-konva',
      'konva/lib/Layer',
      'konva/lib/Stage',
    ])
  );
});
