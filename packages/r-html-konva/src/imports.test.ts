// konva is reached through konva/lib entry points and never through the package
// root. The root barrel pulls every shape, filter and DOM binding into every
// consumer's build, and nothing else would fail if it crept in.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

const SOURCE_ROOT = join(process.cwd(), 'src');

/**
 * The module specifier of a static import, a re-export or a dynamic import. The
 * keyword prefix is what keeps the allowlists below from matching themselves.
 */
const SPECIFIER = /(?:\bfrom|\bimport)\s*\(?\s*'([^']+)'/g;

const KONVA_ROOT = 'konva';

/**
 * What a file that ships may name. Global carries the namespace object the gate
 * configures, DragAndDrop the one registry entry that object reads back, and
 * each remaining entry is one class the host constructs or tests against.
 */
const RUNTIME_MODULES = new Set([
  'konva/lib/Container',
  'konva/lib/DragAndDrop',
  'konva/lib/Global',
  'konva/lib/Group',
  'konva/lib/Layer',
  'konva/lib/Node',
  'konva/lib/Shape',
  'konva/lib/Stage',
  'konva/lib/shapes/Circle',
  'konva/lib/shapes/Line',
  'konva/lib/shapes/Path',
  'konva/lib/shapes/Rect',
  'konva/lib/shapes/Text',
]);

/**
 * One more a shipped file may name by type alone: the context a scene or hit
 * function is handed. Nothing here constructs one, so the build never carries
 * it, and the spec below holds it to an import type.
 */
const TYPE_ONLY_MODULES = new Set(['konva/lib/Context']);

/** A static import with its type keyword, if it carries one, and its specifier. */
const IMPORT_FORM = /\bimport\s+(type\s+)?[^;]*?\bfrom\s*'([^']+)'/g;

/**
 * Three more a spec may name. Animation drives konva's own draw loop and Tween
 * a window the gate hands over, both pinned as upstream behaviour, and Core is
 * the barrel that reaches them and costs 3.3 kB gzipped to name from a build.
 */
const SPEC_ONLY_MODULES = new Set([
  'konva/lib/Animation',
  'konva/lib/Core',
  'konva/lib/Tween',
]);

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

type Reference = { file: string; specifier: string };

function konvaReferences(): Reference[] {
  const references: Reference[] = [];

  for (const path of sourceFiles(SOURCE_ROOT)) {
    const source = readFileSync(path, 'utf8');

    for (const [, specifier] of source.matchAll(SPECIFIER)) {
      if (specifier === KONVA_ROOT || specifier.startsWith(`${KONVA_ROOT}/`)) {
        references.push({ file: posix(path), specifier });
      }
    }
  }

  return references;
}

const offenders = (allowed: Set<string>, scope: (file: string) => boolean) =>
  konvaReferences()
    .filter(({ file, specifier }) => scope(file) && !allowed.has(specifier))
    .map(({ file, specifier }) => `${file}: ${specifier}`)
    .sort();

describe('konva enters this package through konva/lib only (AC-L6)', () => {
  it('imports the package root nowhere', () => {
    const barrel = konvaReferences().filter(
      ({ specifier }) => specifier === KONVA_ROOT
    );

    expect(barrel).toEqual([]);
  });

  it('names only the modules the host constructs, or types', () => {
    const allowed = new Set([...RUNTIME_MODULES, ...TYPE_ONLY_MODULES]);

    expect(offenders(allowed, file => !isSpec(file))).toEqual([]);
  });

  it('names the draw function context by type alone', () => {
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

  it('lets a spec add the draw loop modules and their barrel, and no more', () => {
    const allowed = new Set([
      ...RUNTIME_MODULES,
      ...TYPE_ONLY_MODULES,
      ...SPEC_ONLY_MODULES,
    ]);

    expect(offenders(allowed, isSpec)).toEqual([]);
  });

  it('keeps the draw loop modules and their barrel out of what ships', () => {
    const shipped = konvaReferences()
      .filter(({ file }) => !isSpec(file))
      .map(({ specifier }) => specifier);

    for (const module of SPEC_ONLY_MODULES) {
      expect(shipped).not.toContain(module);
    }
  });

  it('scanned a tree that really does import konva', () => {
    const references = konvaReferences();

    expect(references.length).toBeGreaterThan(10);
    expect(references.map(({ specifier }) => specifier)).toContain(
      'konva/lib/Global'
    );
    expect(references.map(({ file }) => file)).toContain('host.ts');
  });
});
