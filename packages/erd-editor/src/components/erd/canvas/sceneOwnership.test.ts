// P4-A: a scene node owns its own interaction. It calls its own hooks and
// dispatches its own actions, so a callback prop is only justified where a
// parent must coordinate siblings, which today is the column drag pair alone.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

const CANVAS_ROOT = join(process.cwd(), 'src', 'components', 'erd', 'canvas');

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
