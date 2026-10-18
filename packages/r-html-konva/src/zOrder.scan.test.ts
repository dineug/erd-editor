// z-order is the host's ledger and nothing else's. A scan of the source is the
// check, because a single stray call elsewhere would reorder siblings behind
// the ledger without failing a spec.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

const SOURCE_ROOT = join(process.cwd(), 'src');

const Z_ORDER_CALL =
  /\.(setZIndex|moveToTop|moveToBottom|moveTo|moveUp|moveDown)\s*\(/;

/**
 * The two files a z-order call may appear in. The host owns the write, and the
 * marker spec breaks the order on purpose to prove the next commit repairs it.
 */
const Z_ORDER_ALLOWED = ['host.ts', 'host.marker.test.ts'];

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

describe('z-order stays inside the host (AC-G16)', () => {
  it('finds no z-order call outside the files that own one', () => {
    const offenders = sourceFiles(SOURCE_ROOT)
      .filter(path => Z_ORDER_CALL.test(readFileSync(path, 'utf8')))
      .map(posix);

    expect(offenders.sort()).toEqual([...Z_ORDER_ALLOWED].sort());
  });

  it('scanned the source tree it meant to', () => {
    expect(sourceFiles(SOURCE_ROOT).map(posix)).toContain('host.ts');
  });
});
