import { describe, expect, it } from 'vite-plus/test';

import { createTestTheme } from '@/__test-utils__/index';
import {
  Diff,
  diffOutline,
  type DiffPaths,
  diffTextColor,
  ENTITY_PATH,
} from '@/components/erd/diff-viewer/diff';

const theme = createTestTheme();
const paths = (entries: Array<[string, number]>): DiffPaths => new Map(entries);

describe('Diff', () => {
  it('gives each kind of change a bit of its own', () => {
    const bits = Object.values(Diff);

    expect(bits).toEqual([1, 2, 4, 8]);
    expect(bits.reduce((all, bit) => all | bit, 0)).toBe(15);
  });
});

describe('diffTextColor', () => {
  it('colours a cell by its own change: added, removed, changed or renamed', () => {
    const cells = paths([
      ['a', Diff.insert],
      ['b', Diff.delete],
      ['c', Diff.modify],
      ['d', Diff.rename],
    ]);

    expect(diffTextColor(theme, cells, 'a')).toBe(theme.diffInsertForeground);
    expect(diffTextColor(theme, cells, 'b')).toBe(theme.diffDeleteForeground);
    expect(diffTextColor(theme, cells, 'c')).toBe(theme.diffModifyForeground);
    expect(diffTextColor(theme, cells, 'd')).toBe(theme.diffRenameForeground);
  });

  it('colours every cell of a row by the row as a whole, a cell of its own change first', () => {
    const row = paths([
      [ENTITY_PATH, Diff.insert],
      ['columnComment', Diff.modify],
    ]);

    expect(diffTextColor(theme, row, 'columnName', true)).toBe(
      theme.diffInsertForeground
    );
    expect(diffTextColor(theme, row, 'columnComment', true)).toBe(
      theme.diffModifyForeground
    );
    expect(diffTextColor(theme, row, 'columnName')).toBeNull();
  });

  it('colours nothing outside a diff or for a cell that did not change', () => {
    expect(diffTextColor(theme, null, 'tableName')).toBeNull();
    expect(diffTextColor(theme, undefined, 'tableName', true)).toBeNull();
    expect(diffTextColor(theme, paths([]), 'tableName', true)).toBeNull();
  });
});

describe('diffOutline', () => {
  it('outlines an entity added, removed or only moved, and nothing else', () => {
    expect(diffOutline(theme, paths([[ENTITY_PATH, Diff.insert]]))).toBe(
      theme.diffInsertForeground
    );
    expect(diffOutline(theme, paths([[ENTITY_PATH, Diff.delete]]))).toBe(
      theme.diffDeleteForeground
    );
    expect(diffOutline(theme, paths([[ENTITY_PATH, Diff.modify]]))).toBe(
      theme.diffModifyForeground
    );
    expect(diffOutline(theme, paths([['tableName', Diff.rename]]))).toBeNull();
    expect(diffOutline(theme, null)).toBeNull();
  });
});
