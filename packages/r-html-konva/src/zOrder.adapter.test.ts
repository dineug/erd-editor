// The adapter half of the z-order rule: the attributes that would reorder a
// node behind its ledger are refused where they are written, and an id belongs
// to the main canvas alone. zOrder.scan.test.ts holds the source scan.

import { Group } from 'konva/lib/Group';
import { describe, expect, it } from 'vite-plus/test';

import { konvaAdapter, MINIMAP_STAGE_NAME } from '@/host';

/** A ledger tree rooted where the caller says, so the id ban has a root to read. */
function treeUnder(root: Group): Group {
  const layer = new Group();
  const table = new Group();
  konvaAdapter.appendChild(root, layer);
  konvaAdapter.appendChild(layer, table);
  return table;
}

describe('z-order stays inside the host (AC-G16)', () => {
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

describe('the id and name convention (AC-G16)', () => {
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
