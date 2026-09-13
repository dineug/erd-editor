// AC-53 and AC-54: the Focus overlay is gone from the source, not merely
// unmounted. Every name it was built out of is scanned for by hand, because a
// deleted file leaves no type error behind for the compiler to raise.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

import { Open } from '@/constants/open';
import { createEditor, ViewKind } from '@/engine/modules/editor/state';

const SOURCE_ROOT = join(process.cwd(), 'src');

/** This file, which names all five and must not match itself. */
const SELF = 'components/focusViewGone.test.ts';

/**
 * The names the overlay was built out of, each anchored so a longer identifier
 * that merely contains one does not count as a survivor, plus the two word
 * spelling every one of them walked past while it stood in a comment.
 */
const RETIRED: Array<[string, RegExp]> = [
  ['FocusView', /\bFocusView\b/],
  ['FocusBar', /\bFocusBar\b/],
  ['focusExit', /\bfocusExit\b/],
  ['Open.focus', /\bOpen\s*\.\s*focus\b/],
  ['ViewKind.focus', /\bViewKind\s*\.\s*focus\b/],
  [
    'a Focus view, bar or overlay in prose',
    /\bfocus\s+(?:view|overlay|bar)\b/i,
  ],
];

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

const scanned = sourceFiles(SOURCE_ROOT)
  .map(path => ({ path: posix(path), text: readFileSync(path, 'utf8') }))
  .filter(file => file.path !== SELF);

describe('the Focus overlay is gone from the source', () => {
  // A scan that read nothing would pass every case below without looking, so
  // the count is asserted first and every other case rests on it.
  it('reads the whole source tree, which is what the cases below rest on', () => {
    expect(scanned.length).toBeGreaterThan(500);
    expect(scanned.some(({ path }) => path === 'index.ts')).toBe(true);
  });

  it.each(RETIRED)('names %s nowhere under src', (_, pattern) => {
    const hits = scanned
      .filter(({ text }) => pattern.test(text))
      .map(({ path }) => path);

    expect(hits).toEqual([]);
  });
});

describe('the state the overlay stood on is gone', () => {
  it('lists six overlays, the Focus one among them no longer', () => {
    expect(Object.keys(Open)).toEqual([
      'automaticTablePlacement',
      'tableProperties',
      'search',
      'themeBuilder',
      'diffViewer',
      'timeTravel',
    ]);
  });

  it('keeps one view slot and one view kind', () => {
    expect(Object.keys(createEditor().views)).toEqual(['flow']);
    expect(Object.keys(ViewKind)).toEqual(['flow']);
  });
});
