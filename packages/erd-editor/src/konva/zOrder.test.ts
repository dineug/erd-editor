// AC-G16: z-order is the host's ledger and nothing else's, and an id belongs to
// the main canvas alone. The first half is a scan of the source, because a
// single stray call elsewhere would break invariant I1 without failing a spec.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { Group } from 'konva/lib/Group';
import { describe, expect, it } from 'vite-plus/test';

import { konvaAdapter, MINIMAP_STAGE_NAME } from '@/konva/host';

const SOURCE_ROOT = join(process.cwd(), 'src');

const Z_ORDER_CALL =
  /\.(setZIndex|moveToTop|moveToBottom|moveTo|moveUp|moveDown)\s*\(/;

/**
 * The two files a z-order call may appear in. The host owns the write, and the
 * marker spec breaks the order on purpose to prove the next commit repairs it.
 */
const Z_ORDER_ALLOWED = ['konva/host.ts', 'konva/host.marker.test.ts'];

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

/** A ledger tree rooted where the caller says, so the id ban has a root to read. */
function treeUnder(root: Group): Group {
  const layer = new Group();
  const table = new Group();
  konvaAdapter.appendChild(root, layer);
  konvaAdapter.appendChild(layer, table);
  return table;
}

describe('z-order stays inside the host (AC-G16)', () => {
  it('finds no z-order call outside the files that own one', () => {
    const offenders = sourceFiles(SOURCE_ROOT)
      .filter(path => Z_ORDER_CALL.test(readFileSync(path, 'utf8')))
      .map(posix);

    expect(offenders.sort()).toEqual([...Z_ORDER_ALLOWED].sort());
  });

  it('scanned the source tree it meant to', () => {
    const files = sourceFiles(SOURCE_ROOT);

    expect(files.length).toBeGreaterThan(100);
    expect(files.map(posix)).toContain('konva/host.ts');
  });

  it('refuses a zIndex write, the attr that reorders behind the ledger', () => {
    const node = new Group();

    expect(() => konvaAdapter.setAttribute(node, 'zIndex', 2, true)).toThrow(
      /not a konva attribute/
    );
    expect(() => konvaAdapter.setAttribute(node, 'class', 'a', true)).toThrow(
      /not a konva attribute/
    );
    expect(() => konvaAdapter.setAttribute(node, 'style', 'a', true)).toThrow(
      /not a konva attribute/
    );
  });
});

describe('the id and name convention (P0-2)', () => {
  it('lets a node of the main canvas carry an id', () => {
    const table = treeUnder(new Group({ name: 'canvas' }));

    konvaAdapter.setAttribute(table, 'id', 'table-t1', true);

    expect(table.id()).toBe('table-t1');
  });

  it('refuses an id anywhere under the minimap', () => {
    const table = treeUnder(new Group({ name: MINIMAP_STAGE_NAME }));

    expect(() =>
      konvaAdapter.setAttribute(table, 'id', 'table-t1', true)
    ).toThrow(/not the minimap's to carry/);
    expect(table.id()).toBe('');
  });

  it('takes a name and a tableId from a minimap node instead', () => {
    const table = treeUnder(new Group({ name: MINIMAP_STAGE_NAME }));

    konvaAdapter.setAttribute(table, 'name', 'minimap-table', true);
    konvaAdapter.setAttribute(table, 'tableId', 't1', true);

    expect(table.hasName('minimap-table')).toBe(true);
    expect(table.getAttr('tableId')).toBe('t1');
    expect(table.id()).toBe('');
  });

  it('reads the root through the ledger, not through the konva parent', () => {
    const root = new Group({ name: MINIMAP_STAGE_NAME });
    const table = treeUnder(root);

    expect(table.getParent()).toBeNull();
    expect(() =>
      konvaAdapter.setAttribute(table, 'id', 'table-t1', true)
    ).toThrow(/not the minimap's to carry/);
  });
});
