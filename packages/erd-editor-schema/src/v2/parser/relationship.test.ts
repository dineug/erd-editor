import { describe, expect, it } from 'vitest';

import { createAndMergeRelationshipEntity } from '@/v2/parser/relationship';

const defaultRelationship = {
  id: '',
  identification: false,
  relationshipType: 'ZeroN',
  startRelationshipType: 'Dash',
  start: {
    tableId: '',
    columnIds: [],
    x: 0,
    y: 0,
    direction: 'bottom',
  },
  end: {
    tableId: '',
    columnIds: [],
    x: 0,
    y: 0,
    direction: 'bottom',
  },
  constraintName: '',
  visible: true,
};

describe('createAndMergeRelationshipEntity', () => {
  it('returns an empty entity when json is nill', () => {
    expect(createAndMergeRelationshipEntity()).toEqual({ relationships: [] });
    expect(createAndMergeRelationshipEntity(null as any)).toEqual({
      relationships: [],
    });
  });

  it('returns an empty entity when relationships is not an array', () => {
    expect(
      createAndMergeRelationshipEntity({ relationships: {} } as any)
    ).toEqual({ relationships: [] });
    expect(createAndMergeRelationshipEntity({} as any)).toEqual({
      relationships: [],
    });
  });

  it('fills defaults for an empty relationship object', () => {
    const result = createAndMergeRelationshipEntity({
      relationships: [{}],
    } as any);

    expect(result.relationships).toHaveLength(1);
    expect(result.relationships[0]).toEqual(defaultRelationship);
  });

  it('merges every valid field', () => {
    const result = createAndMergeRelationshipEntity({
      relationships: [
        {
          id: 'rel-1',
          constraintName: 'fk_a_b',
          identification: true,
          visible: false,
          relationshipType: 'ZeroOne',
          startRelationshipType: 'Ring',
          start: {
            tableId: 'table-a',
            columnIds: ['col-1', 'col-2'],
            x: 10,
            y: 20,
            direction: 'left',
          },
          end: {
            tableId: 'table-b',
            columnIds: ['col-3'],
            x: 30,
            y: 40,
            direction: 'top',
          },
        },
      ],
    });

    expect(result.relationships[0]).toEqual({
      id: 'rel-1',
      constraintName: 'fk_a_b',
      identification: true,
      visible: false,
      relationshipType: 'ZeroOne',
      startRelationshipType: 'Ring',
      start: {
        tableId: 'table-a',
        columnIds: ['col-1', 'col-2'],
        x: 10,
        y: 20,
        direction: 'left',
      },
      end: {
        tableId: 'table-b',
        columnIds: ['col-3'],
        x: 30,
        y: 40,
        direction: 'top',
      },
    });
  });

  it.each([
    ['ZeroOneN', 'ZeroN'],
    ['One', 'OneOnly'],
    ['N', 'OneN'],
  ])('migrates the legacy relationshipType %s to %s', (input, expected) => {
    const result = createAndMergeRelationshipEntity({
      relationships: [{ relationshipType: input }],
    } as any);

    expect(result.relationships[0].relationshipType).toBe(expected);
  });

  it('falls back to ZeroN for an unknown relationshipType', () => {
    const result = createAndMergeRelationshipEntity({
      relationships: [{ relationshipType: 'Many' }, { relationshipType: 7 }],
    } as any);

    expect(result.relationships[0].relationshipType).toBe('ZeroN');
    expect(result.relationships[1].relationshipType).toBe('ZeroN');
  });

  it('rejects an unknown startRelationshipType', () => {
    const result = createAndMergeRelationshipEntity({
      relationships: [{ startRelationshipType: 'Arrow' }],
    } as any);

    expect(result.relationships[0].startRelationshipType).toBe('Dash');
  });

  it('rejects an unknown direction on both points', () => {
    const result = createAndMergeRelationshipEntity({
      relationships: [
        {
          start: { direction: 'diagonal' },
          end: { direction: 99 },
        },
      ],
    } as any);

    expect(result.relationships[0].start.direction).toBe('bottom');
    expect(result.relationships[0].end.direction).toBe('bottom');
  });

  it('ignores point values with the wrong type', () => {
    const result = createAndMergeRelationshipEntity({
      relationships: [
        {
          id: 12,
          constraintName: null,
          identification: 'true',
          visible: 1,
          start: { tableId: 5, x: '1', y: null },
          end: { tableId: {}, x: [], y: undefined },
        },
      ],
    } as any);

    expect(result.relationships[0]).toEqual(defaultRelationship);
  });

  it('filters out non-string columnIds', () => {
    const result = createAndMergeRelationshipEntity({
      relationships: [
        {
          start: { columnIds: ['a', 1, null, 'b', undefined, {}] },
          end: { columnIds: [2, 'c'] },
        },
      ],
    } as any);

    expect(result.relationships[0].start.columnIds).toEqual(['a', 'b']);
    expect(result.relationships[0].end.columnIds).toEqual(['c']);
  });

  it('keeps the default columnIds when they are not arrays', () => {
    const result = createAndMergeRelationshipEntity({
      relationships: [
        {
          start: { columnIds: 'a,b' },
          end: { columnIds: 3 },
        },
      ],
    } as any);

    expect(result.relationships[0].start.columnIds).toEqual([]);
    expect(result.relationships[0].end.columnIds).toEqual([]);
  });

  it('parses several relationships into independent objects', () => {
    const result = createAndMergeRelationshipEntity({
      relationships: [{ id: 'a' }, { id: 'b' }],
    } as any);

    expect(result.relationships.map(it => it.id)).toEqual(['a', 'b']);
    expect(result.relationships[0].start).not.toBe(
      result.relationships[1].start
    );
  });
});
