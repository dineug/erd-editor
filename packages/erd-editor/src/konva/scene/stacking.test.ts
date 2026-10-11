import { describe, expect, it } from 'vite-plus/test';

import type { Memo, Table } from '@/internal-types';
import { stackedKey, stackTablesAndMemos } from '@/konva/scene/stacking';

const table = (id: string, zIndex: number) =>
  ({ id, ui: { x: 0, y: 0, zIndex } }) as Table;

const memo = (id: string, zIndex: number) =>
  ({ id, ui: { x: 0, y: 0, width: 10, height: 10, zIndex } }) as Memo;

describe('stackTablesAndMemos', () => {
  it('interleaves tables and memos by z-index, lowest first', () => {
    const stack = stackTablesAndMemos(
      [table('t1', 5), table('t2', 2)],
      [memo('m1', 3), memo('m2', 7)]
    );

    expect(stack.map(stackedKey)).toEqual([
      'table:t2',
      'memo:m1',
      'table:t1',
      'memo:m2',
    ]);
  });

  it('keeps each list in its own order on a tie, every memo over a table of its z-index', () => {
    const stack = stackTablesAndMemos(
      [table('t1', 2), table('t2', 2)],
      [memo('m1', 2), memo('m2', 2)]
    );

    expect(stack.map(stackedKey)).toEqual([
      'table:t1',
      'table:t2',
      'memo:m1',
      'memo:m2',
    ]);
  });

  it('hands back the entities themselves, told apart by kind', () => {
    const t1 = table('t1', 2);
    const m1 = memo('m1', 3);

    expect(stackTablesAndMemos([t1], [m1])).toEqual([
      { kind: 'table', entity: t1 },
      { kind: 'memo', entity: m1 },
    ]);
  });
});
