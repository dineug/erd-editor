// @vitest-environment node

// The modules the read-only view composes, walked as a bundler follows them and
// judged by the boundary file pnpm dist-shape holds erd-viewer.js to, while the
// paths that still pull the editor in are listed, each with what pulls it.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

import {
  IMPORT_FORM,
  PACKAGE_ROOT,
  SOURCE_ROOT,
  walk,
} from '@/__test-utils__/importGraph';

type BoundaryPath = { path: string; why: string };

type BoundaryPackage = { name: string; why: string };

type Boundary = {
  forbiddenPaths: BoundaryPath[];
  forbiddenPackages: BoundaryPackage[];
  bareAllowlist: BoundaryPackage[];
};

const boundary: Boundary = JSON.parse(
  readFileSync(
    join(PACKAGE_ROOT, '..', '..', 'scripts', 'viewer-boundary.json'),
    'utf8'
  )
);

/**
 * The rule viewer-boundary.json states and scripts/viewer-boundary.mjs keeps:
 * a path or a package matches an entry it equals or sits below past a slash or a dot.
 */
const matchesEntry = (value: string, entry: string) =>
  value === entry ||
  value.startsWith(`${entry}/`) ||
  value.startsWith(`${entry}.`);

/** A specifier folded to its package, so konva/lib/Stage is konva. */
const packageOf = (specifier: string) =>
  specifier
    .split('/')
    .slice(0, specifier.startsWith('@') ? 2 : 1)
    .join('/');

const modulePathOf = (file: string) => file.replace(/\.tsx?$/, '');

/**
 * The view and what it mounts and reads: its press rule, canvas, scrollbars,
 * map, controls and palette, its store, keys, press mode and measure, its fit
 * and its lights, and the theme and language its element takes from a page.
 */
const ROOTS = [
  'components/erd-view/ErdView.tsx',
  'components/erd-view/pressHandler.ts',
  'components/erd/canvas/Canvas.tsx',
  'components/erd/canvas/CanvasScene.tsx',
  'components/erd/virtual-scroll/VirtualScroll.tsx',
  'components/erd/minimap/Minimap.tsx',
  'components/erd/view-controls/zoomControls.tsx',
  'components/erd/view-controls/nameViewDropdown.tsx',
  'components/erd/view-controls/ToolbarCompass.template.tsx',
  'components/quick-search/QuickSearch.tsx',
  'components/appContext.ts',
  'hooks/useKeyBindingMap.ts',
  'hooks/useViewShortcut.ts',
  'components/sceneInteractionContext.ts',
  'components/erd-view/viewportMeasure.ts',
  'konva/scene/fitZoom.ts',
  'components/erd/relationshipHighlight.ts',
  'components/erd/canvas/highlightTransition.ts',
  'components/element-host/themeHost.ts',
  'components/element-host/localeHost.ts',
];

/**
 * Each boundary entry the roots still reach, with what pulls it in. A change
 * that cuts one off takes its line out, and one that reaches another entry
 * fails here, so the list only shrinks.
 */
const PENDING: Record<string, string> = {};

const manifest = JSON.parse(
  readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')
);

/** The JSX transform, which every build and test runs and no bundle holds. */
const BUILD_PLUGIN = '@dineug/vite-plugin-r-html';

/**
 * The private workspace libraries, which the build inlines rather than imports:
 * the folders INLINED_LIBRARIES in scripts/viewer-boundary.mjs names.
 */
const inlinedWorkspaceLibraries = Object.entries(
  manifest.devDependencies as Record<string, string>
)
  .filter(
    ([name, version]) =>
      version.startsWith('workspace:') && name !== BUILD_PLUGIN
  )
  .map(([name]) => name)
  .sort();

function graphOf(roots: string[]) {
  const files = new Set<string>();
  const packages = new Set<string>();

  for (const root of roots) {
    const graph = walk(join(SOURCE_ROOT, root));
    graph.files.forEach(file => files.add(modulePathOf(file)));
    [...graph.bare.keys()].forEach(specifier =>
      packages.add(packageOf(specifier))
    );
  }

  return { files: [...files].sort(), packages: [...packages].sort() };
}

/** The boundary entries a graph reaches, each with the first module or package that matched it. */
function reachedEntries({ files, packages }: ReturnType<typeof graphOf>) {
  const reached = new Map<string, string>();

  for (const { path } of boundary.forbiddenPaths) {
    const file = files.find(file => matchesEntry(file, path));
    if (file) reached.set(path, file);
  }
  for (const { name } of boundary.forbiddenPackages) {
    const found = packages.find(specifier => matchesEntry(specifier, name));
    if (found) reached.set(name, found);
  }

  return reached;
}

describe('the view source graph', () => {
  const graph = graphOf(ROOTS);
  const reached = reachedEntries(graph);

  it('starts at the modules the view composes', () => {
    expect(graph.files).toEqual(
      expect.arrayContaining(ROOTS.map(modulePathOf))
    );
  });

  it('reaches no boundary entry the pending list leaves out', () => {
    const unlisted = [...reached]
      .filter(([entry]) => !(entry in PENDING))
      .map(([entry, by]) => `${entry} <- ${by}`);

    expect(unlisted).toEqual([]);
  });

  it('still reaches every pending entry, so one cut off leaves the list', () => {
    expect(Object.keys(PENDING).filter(entry => !reached.has(entry))).toEqual(
      []
    );
  });

  it('names only packages the boundary allows or the build inlines', () => {
    const forbidden = boundary.forbiddenPackages.map(({ name }) => name);
    const allowed = new Set([
      ...boundary.bareAllowlist.map(({ name }) => name),
      ...inlinedWorkspaceLibraries.filter(
        name => !forbidden.some(entry => matchesEntry(name, entry))
      ),
    ]);
    const offenders = graph.packages.filter(
      name =>
        !allowed.has(name) &&
        !forbidden.some(entry => matchesEntry(name, entry))
    );

    expect(offenders).toEqual([]);
  });
});

describe('the boundary file against the editor', () => {
  it('names only paths the editor reaches, so no entry guards nothing', () => {
    const { files } = graphOf(['erd-editor.ts']);
    const unreached = boundary.forbiddenPaths
      .map(({ path }) => path)
      .filter(path => !files.some(file => matchesEntry(file, path)));

    expect(unreached).toEqual([]);
  });

  it('allows the six workspace libraries the build inlines, all but the build plugin', () => {
    expect(inlinedWorkspaceLibraries).toEqual([
      '@dineug/erd-editor-schema',
      '@dineug/grid',
      '@dineug/r-html',
      '@dineug/r-html-konva',
      '@dineug/schema-sql-parser',
      '@dineug/uuid',
    ]);
  });

  it('leaves @dineug/grid the one inlined library the view may not reach', () => {
    const forbidden = inlinedWorkspaceLibraries.filter(name =>
      boundary.forbiddenPackages.some(entry => matchesEntry(name, entry.name))
    );

    expect(forbidden).toEqual(['@dineug/grid']);
  });
});

describe('the scan', () => {
  it('matches an entry by whole segments alone', () => {
    expect(
      matchesEntry(
        'components/erd/table-group/tableGroupName',
        'components/erd/table-group'
      )
    ).toBe(true);
    expect(
      matchesEntry(
        'components/erd/canvas/EditOverlay.styles',
        'components/erd/canvas/EditOverlay'
      )
    ).toBe(true);
    expect(
      matchesEntry(
        'components/erd/canvas/table-group/TableGroups',
        'components/erd/table-group'
      )
    ).toBe(false);
    expect(
      matchesEntry('utils/schema-sql-parser/index', 'utils/schema-sql')
    ).toBe(false);
    expect(matchesEntry('@shikijs/langs', '@shikijs')).toBe(true);
  });

  it('folds a subpath import to the package it names', () => {
    expect(packageOf('konva/lib/Stage')).toBe('konva');
    expect(packageOf('es-toolkit/compat')).toBe('es-toolkit');
    expect(packageOf('@dineug/r-html')).toBe('@dineug/r-html');
    expect(packageOf('@shikijs/langs/sql')).toBe('@shikijs/langs');
  });

  it('reads no import out of a key or a string that ends in import', () => {
    const source = `const label = t('palette.import');
const messages = { 'common.import': 'Import' };
import './side-effect';
await import('./lazy');`;
    const specifiers = [...source.matchAll(IMPORT_FORM)].map(
      match => match[4] ?? match[5] ?? match[6]
    );

    expect(specifiers).toEqual(['./side-effect', './lazy']);
  });
});
