// AC-L6: konva is reached through konva/lib entry points and never through the
// package root. The root barrel pulls every shape, filter and DOM binding into
// a build that names eleven classes, and nothing else would fail if it crept in.

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
 * What a file that ships may name. Global carries the namespace object the host
 * configures, DragAndDrop the one registry entry that object reads back, and
 * each remaining entry is one class the scene constructs.
 */
const RUNTIME_MODULES = new Set([
  'konva/lib/Container',
  'konva/lib/DragAndDrop',
  'konva/lib/Global',
  'konva/lib/Group',
  'konva/lib/Layer',
  'konva/lib/Node',
  'konva/lib/Stage',
  'konva/lib/shapes/Circle',
  'konva/lib/shapes/Line',
  'konva/lib/shapes/Path',
  'konva/lib/shapes/Rect',
  'konva/lib/shapes/Text',
  'konva/lib/Tween',
]);

/** The one shipped module allowed to name Tween, which is the flip it drives. */
const TWEEN_OWNER = 'konva/scene/konvaFlip.ts';

/**
 * Two more a spec may name. Animation drives konva's own draw loop, which the
 * specs pin as upstream behaviour rather than call, and Core is the barrel that
 * reaches it and costs 3.3 kB gzipped to name from a build.
 */
const SPEC_ONLY_MODULES = new Set(['konva/lib/Animation', 'konva/lib/Core']);

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

  it('names only the modules the host and the scene construct', () => {
    expect(offenders(RUNTIME_MODULES, file => !isSpec(file))).toEqual([]);
  });

  it('lets a spec add the draw loop modules and their barrel, and no more', () => {
    const allowed = new Set([...RUNTIME_MODULES, ...SPEC_ONLY_MODULES]);

    expect(offenders(allowed, isSpec)).toEqual([]);
  });

  it('lets the flip alone name the tween it runs on', () => {
    const owners = konvaReferences()
      .filter(
        ({ file, specifier }) =>
          !isSpec(file) && specifier === 'konva/lib/Tween'
      )
      .map(({ file }) => file);

    expect(owners).toEqual([TWEEN_OWNER]);
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
    expect(references.map(({ file }) => file)).toContain('konva/host.ts');
  });
});

/**
 * The DOM rasterizer that drew the PNG export before the scene moved to canvas.
 * It is declared nowhere now, so a returning import would not even resolve, and
 * a measured 5,155 B gzipped rides back into the build with it.
 */
const REMOVED_RASTERIZER = 'html-to-image';

/** The dependency fields npm resolves for a consumer of this package. */
const MANIFEST_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];

function rasterizerReferences(): Reference[] {
  const references: Reference[] = [];

  for (const path of sourceFiles(SOURCE_ROOT)) {
    const source = readFileSync(path, 'utf8');

    for (const [, specifier] of source.matchAll(SPECIFIER)) {
      if (
        specifier === REMOVED_RASTERIZER ||
        specifier.startsWith(`${REMOVED_RASTERIZER}/`)
      ) {
        references.push({ file: posix(path), specifier });
      }
    }
  }

  return references;
}

describe('the DOM rasterizer left with the DOM scene', () => {
  it('is imported by no file in the package', () => {
    expect(rasterizerReferences()).toEqual([]);
  });

  it('is declared by no dependency field of the manifest', () => {
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf8')
    );

    const declared = MANIFEST_FIELDS.filter(field =>
      Object.hasOwn(manifest[field] ?? {}, REMOVED_RASTERIZER)
    );

    expect(declared).toEqual([]);
  });

  it('scanned the tree and the manifest that used to name it', () => {
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf8')
    );

    expect(sourceFiles(SOURCE_ROOT).map(posix)).toContain(
      'utils/file/exportFile.ts'
    );
    expect(Object.keys(manifest.devDependencies)).toContain('konva');
  });
});
