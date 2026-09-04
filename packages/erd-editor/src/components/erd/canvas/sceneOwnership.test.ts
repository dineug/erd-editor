// P4-A: a scene node owns its own interaction. It calls its own hooks and
// dispatches its own actions, so a callback prop is only justified where a
// parent must coordinate siblings, which today is the column drag pair alone.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

const SRC_ROOT = join(process.cwd(), 'src');

const CANVAS_ROOT = join(SRC_ROOT, 'components', 'erd', 'canvas');

const CALLBACK_PROP_DECLARATION = /\bon[A-Z][A-Za-z0-9_]*\??\s*:/g;

const CALLBACK_PROP_PASSED = /\bon[A-Z][A-Za-z0-9_]*\s*=\{/g;

/**
 * Column hands the drag boundary up because Table decides the drop index, and
 * that decision reads the order of every sibling column. Nothing else in the
 * scene needs a parent to answer a question for it.
 */
const DECLARED = [
  'table/column/Column.tsx onDragend',
  'table/column/Column.tsx onDragstart',
];

const PASSED = ['table/Table.tsx onDragend', 'table/Table.tsx onDragstart'];

/**
 * The two dom files AC-S1 whitelists under this root. They mount dom shells and
 * primitives rather than konva nodes, so the props they hand down are the ones
 * those primitives have always taken and say nothing about scene ownership.
 */
const DOM_SHELLS = ['Canvas.tsx', 'EditOverlay.tsx'];

const isSpec = (file: string) =>
  /\.(test|test-d|browser\.test)\.tsx?$/.test(file);

function sceneFiles(directory: string, found: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      sceneFiles(path, found);
    } else if (/\.tsx$/.test(entry.name) && !isSpec(entry.name)) {
      found.push(path);
    }
  }

  return found;
}

const posix = (path: string) =>
  relative(CANVAS_ROOT, path).split(sep).join('/');

function hits(pattern: RegExp, skip: string[] = []): string[] {
  const found: string[] = [];

  for (const path of sceneFiles(CANVAS_ROOT)) {
    if (skip.includes(posix(path))) continue;

    const source = readFileSync(path, 'utf8');

    for (const match of source.matchAll(pattern)) {
      const name = /on[A-Z][A-Za-z0-9_]*/.exec(match[0]) as RegExpExecArray;
      found.push(`${posix(path)} ${name[0]}`);
    }
  }

  return found.sort();
}

describe('the canvas scene owns its interaction (P4-A)', () => {
  it('declares a callback prop only where a parent coordinates siblings', () => {
    expect(hits(CALLBACK_PROP_DECLARATION)).toEqual([...DECLARED].sort());
  });

  it('passes a callback prop only from the table that owns the drop order', () => {
    expect(hits(CALLBACK_PROP_PASSED, DOM_SHELLS)).toEqual([...PASSED].sort());
  });

  it('scanned the scene tree it meant to, specs excluded', () => {
    const files = sceneFiles(CANVAS_ROOT).map(posix);

    expect(files).toContain('table/Table.tsx');
    expect(files).toContain('memo/Memo.tsx');
    expect(files).toContain('high-level-table/HighLevelTable.tsx');
    expect(files.filter(file => file.includes('.test.'))).toEqual([]);
    expect(files.length).toBeGreaterThan(10);

    for (const shell of DOM_SHELLS) expect(files).toContain(shell);
  });
});

/**
 * AC-S1. The scene is konva, so a dom tag written in jsx under this root is
 * either a shell that owns the stage container or a leak. Both spellings are
 * here because the svg scene these replaced was one element holding shapes.
 */
const DOM_TAG = /<(div|svg)\b/;

/**
 * AC-G17. Every reference to this root from outside it, as file and import
 * target with its multiplicity kept, so a second copy of one import in one file
 * still fails. Line numbers are left out because formatting moves them.
 */
const OUTSIDE_REFERENCES = [
  'components/erd/Erd.tsx @/components/erd/canvas/Canvas',
  'components/erd/automatic-table-placement/AutomaticTablePlacement.tsx @/components/erd/canvas/Canvas',
  'components/erd/diff-viewer/erd-viewer/ErdViewer.tsx @/components/erd/canvas/Canvas',
  'components/erd/hitTest.browser.test.tsx @/components/erd/canvas/CanvasScene',
  'components/erd/minimap/Minimap.browser.test.tsx @/components/erd/canvas/Canvas.styles',
  'components/erd/minimap/Minimap.tsx @/components/erd/canvas/Canvas.styles',
  'components/erd/time-travel/TimeTravel.tsx @/components/erd/canvas/Canvas',
  'components/themeContext.browser.test.tsx @/components/erd/canvas/memo/Memo',
  'services/export-png/ExportScene.tsx @/components/erd/canvas/memo/Memo',
  'services/export-png/ExportScene.tsx @/components/erd/canvas/relationship-group/RelationshipGroup',
  'services/export-png/ExportScene.tsx @/components/erd/canvas/table/Table',
];

const CANVAS_REFERENCE = /@\/components\/erd\/canvas\/[\w./-]+/g;

function sourceFiles(directory: string, found: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      sourceFiles(path, found);
    } else if (/\.tsx?$/.test(entry.name)) {
      found.push(path);
    }
  }

  return found;
}

const fromSrc = (path: string) => relative(SRC_ROOT, path).split(sep).join('/');

describe('the canvas root keeps its boundary (P6-51)', () => {
  it('writes a dom tag in the two shells alone, and konva everywhere else', () => {
    // Jsx only. Four .test.ts specs mount an html host to read a hook's return,
    // which is a harness rather than a scene, and none of them is compiled by
    // the konva jsx host in the first place.
    const withDomTag = sourceFiles(CANVAS_ROOT)
      .filter(path => path.endsWith('.tsx'))
      .filter(path => DOM_TAG.test(readFileSync(path, 'utf8')))
      .map(posix)
      .sort();

    expect(withDomTag).toEqual([...DOM_SHELLS].sort());
  });

  it('is reached from outside by the eleven references that own a reason to', () => {
    const references = sourceFiles(SRC_ROOT)
      .filter(path => !path.startsWith(CANVAS_ROOT))
      .flatMap(path =>
        [...readFileSync(path, 'utf8').matchAll(CANVAS_REFERENCE)].map(
          match => `${fromSrc(path)} ${match[0]}`
        )
      )
      .sort();

    expect(references).toEqual([...OUTSIDE_REFERENCES].sort());
  });

  it('scanned the package, and this file is outside its own count', () => {
    // Vacuous otherwise: the whitelist above is a literal list of the string it
    // greps for, and it lives under the root the second assertion excludes.
    const files = sourceFiles(SRC_ROOT).map(fromSrc);

    expect(files).toContain('components/erd/Erd.tsx');
    expect(files).toContain('components/erd/canvas/sceneOwnership.test.ts');
    expect(files.length).toBeGreaterThan(500);
  });
});
