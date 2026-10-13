// AC-R10: the floating Find and Replace panel is gone from the source, its
// search living on in the Explorer. Every name it stood on is scanned for by
// hand, because a deleted file leaves no type error behind to raise.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

import { Open } from '@/constants/open';
import { isTakenOver } from '@/utils/takeover';

const SOURCE_ROOT = join(process.cwd(), 'src');

/** This file, which names every one of them and must not match itself. */
const SELF = 'components/findPanelGone.test.ts';

/**
 * The names the panel was built out of, each anchored so a longer identifier
 * that merely holds one, such as FindReplaceQuery or find-replace-all, does
 * not count as a survivor.
 */
const RETIRED: Array<[string, RegExp]> = [
  ['FindReplace', /\bFindReplace\b/],
  ['panelLayout', /\bpanelLayout\b/],
  ['coveredWidth', /\bcoveredWidth\b/],
  ['MIN_CLEAR_WIDTH', /\bMIN_CLEAR_WIDTH\b/],
  ['PANEL_LEFT', /\bPANEL_LEFT\b/],
  ['isPanelShown', /\bisPanelShown\b/],
  ['Open.findReplace', /\bOpen\s*\.\s*findReplace\b/],
  ['the find-replace class', /['"`.\s]find-replace(?![-\w])/],
  ['components/find-replace', /components\/find-replace\b/],
  ['findReplace.showing', /\bfindReplace\.showing\b/],
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

describe('the floating Find and Replace panel is gone from the source', () => {
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

  it('leaves no directory of its own', () => {
    expect(existsSync(join(SOURCE_ROOT, 'components/find-replace'))).toBe(
      false
    );
  });

  it('keeps no overlay for it, and the takeover check in src/utils/takeover.ts', () => {
    expect(Object.keys(Open)).not.toContain('findReplace');
    expect(typeof isTakenOver).toBe('function');
    expect(existsSync(join(SOURCE_ROOT, 'utils/takeover.ts'))).toBe(true);
  });
});
