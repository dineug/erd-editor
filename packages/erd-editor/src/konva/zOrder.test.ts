// z-order is the Konva host's ledger and nothing else's, and the host lives in
// @dineug/r-html-konva, so no file here may call a z-order method. A scan of the
// source is the check, because one stray call would fail no other spec.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

const SOURCE_ROOT = join(process.cwd(), 'src');

const Z_ORDER_CALL =
  /\.(setZIndex|moveToTop|moveToBottom|moveTo|moveUp|moveDown)\s*\(/;

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
  it('finds no z-order call in the scene that renders through the host', () => {
    const offenders = sourceFiles(SOURCE_ROOT)
      .filter(path => Z_ORDER_CALL.test(readFileSync(path, 'utf8')))
      .map(posix);

    expect(offenders).toEqual([]);
  });

  it('scanned the source tree it meant to', () => {
    const files = sourceFiles(SOURCE_ROOT);

    expect(files.length).toBeGreaterThan(100);
    expect(files.map(posix)).toContain('components/erd/canvas/CanvasScene.tsx');
  });
});
