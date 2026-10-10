import { describe, expect, it } from 'vite-plus/test';

import {
  createAndMergeTableEntities,
  createTable,
} from '@/v3/parser/table.entity';

describe('createTable', () => {
  it('creates a table with the default ui', () => {
    const table = createTable();

    expect(table.id).toBe('');
    expect(table.name).toBe('');
    expect(table.comment).toBe('');
    expect(table.columnIds).toEqual([]);
    expect(table.seqColumnIds).toEqual([]);
    expect(table.groupId).toBe('');
    expect(table.ui).toEqual({
      x: 200,
      y: 100,
      zIndex: 2,
      widthName: 60,
      widthComment: 60,
      color: '',
    });
    expect(table).not.toHaveProperty('meta');
  });
});

describe('createAndMergeTableEntities', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['number', 1],
    ['array', []],
  ])('returns an empty record for a non-object source (%s)', (_l, source) => {
    expect(createAndMergeTableEntities(source as any)).toEqual({});
  });

  it('skips falsy entries and entries without an id', () => {
    const entities = createAndMergeTableEntities({
      a: null as any,
      b: { name: 'no-id' },
    });

    expect(entities).toEqual({});
  });

  it('merges every field', () => {
    const entities = createAndMergeTableEntities({
      key: {
        id: 't1',
        name: 'users',
        comment: 'user table',
        columnIds: ['c1', 'c2'],
        seqColumnIds: ['c1', 'c2', 'c3'],
        groupId: 'g1',
        ui: {
          x: 10,
          y: 20,
          zIndex: 5,
          widthName: 80,
          widthComment: 90,
          color: '#123456',
        },
      },
    });

    expect(entities.t1).toEqual({
      id: 't1',
      name: 'users',
      comment: 'user table',
      columnIds: ['c1', 'c2'],
      seqColumnIds: ['c1', 'c2', 'c3'],
      groupId: 'g1',
      ui: {
        x: 10,
        y: 20,
        zIndex: 5,
        widthName: 80,
        widthComment: 90,
        color: '#123456',
      },
    });
  });

  it('ignores wrongly typed values', () => {
    const entities = createAndMergeTableEntities({
      key: {
        id: 't1',
        name: 1 as any,
        columnIds: 'c1' as any,
        groupId: 7 as any,
        ui: { x: '10' as any, color: 3 as any, widthName: 80 },
      },
    });

    const table = entities.t1;
    expect(table.name).toBe('');
    expect(table.columnIds).toEqual([]);
    expect(table.groupId).toBe('');
    expect(table.ui.x).toBe(200);
    expect(table.ui.color).toBe('');
    expect(table.ui.widthName).toBe(80);
  });

  it('keeps a group id naming no group as saved, for the readers to judge', () => {
    const entities = createAndMergeTableEntities({
      key: { id: 't1', groupId: 'gone' },
    });

    expect(entities.t1.groupId).toBe('gone');
  });

  it('keeps the ui defaults when ui is missing', () => {
    const entities = createAndMergeTableEntities({ key: { id: 't1' } });

    expect(entities.t1.ui).toEqual({
      x: 200,
      y: 100,
      zIndex: 2,
      widthName: 60,
      widthComment: 60,
      color: '',
    });
  });

  it('merges several tables', () => {
    const entities = createAndMergeTableEntities({
      a: { id: 'a' },
      b: { id: 'b' },
    });

    expect(Object.keys(entities).sort()).toEqual(['a', 'b']);
  });
});
