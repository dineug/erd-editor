import { describe, expect, it } from 'vitest';

import {
  createAndMergeRelationshipEntities,
  createRelationship,
} from '@/v3/parser/relationship.entity';
import {
  Direction,
  RelationshipType,
  StartRelationshipType,
} from '@/v3/schema/relationship.entity';

describe('createRelationship', () => {
  it('creates a relationship with defaults', () => {
    const relationship = createRelationship();

    expect(relationship).toMatchObject({
      id: '',
      identification: false,
      relationshipType: RelationshipType.ZeroN,
      startRelationshipType: StartRelationshipType.dash,
      start: {
        tableId: '',
        columnIds: [],
        x: 0,
        y: 0,
        direction: Direction.bottom,
      },
      end: {
        tableId: '',
        columnIds: [],
        x: 0,
        y: 0,
        direction: Direction.bottom,
      },
    });
    expect(relationship.meta.createAt).toBe(relationship.meta.updateAt);
  });

  it('does not share the start and end points between instances', () => {
    const a = createRelationship();
    const b = createRelationship();

    expect(a.start).not.toBe(b.start);
    expect(a.start).not.toBe(a.end);
  });
});

describe('createAndMergeRelationshipEntities', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['string', 'nope'],
    ['array', []],
  ])('returns an empty record for a non-object source (%s)', (_l, source) => {
    expect(createAndMergeRelationshipEntities(source as any)).toEqual({});
  });

  it('skips falsy entries and entries without an id', () => {
    expect(
      createAndMergeRelationshipEntities({
        a: null as any,
        b: { identification: true },
      })
    ).toEqual({});
  });

  it('merges every field', () => {
    const entities = createAndMergeRelationshipEntities({
      key: {
        id: 'r1',
        identification: true,
        relationshipType: RelationshipType.OneN,
        startRelationshipType: StartRelationshipType.ring,
        start: {
          tableId: 't1',
          columnIds: ['c1'],
          x: 10,
          y: 20,
          direction: Direction.left,
        },
        end: {
          tableId: 't2',
          columnIds: ['c2', 'c3'],
          x: 30,
          y: 40,
          direction: Direction.top,
        },
        meta: { updateAt: 9, createAt: 10 },
      },
    });

    expect(entities.r1).toEqual({
      id: 'r1',
      identification: true,
      relationshipType: RelationshipType.OneN,
      startRelationshipType: StartRelationshipType.ring,
      start: {
        tableId: 't1',
        columnIds: ['c1'],
        x: 10,
        y: 20,
        direction: Direction.left,
      },
      end: {
        tableId: 't2',
        columnIds: ['c2', 'c3'],
        x: 30,
        y: 40,
        direction: Direction.top,
      },
      meta: { updateAt: 9, createAt: 10 },
    });
  });

  it('ignores relationship types outside their enum lists', () => {
    const entities = createAndMergeRelationshipEntities({
      key: {
        id: 'r1',
        relationshipType: 999,
        startRelationshipType: 0,
      },
    });

    expect(entities.r1.relationshipType).toBe(RelationshipType.ZeroN);
    expect(entities.r1.startRelationshipType).toBe(StartRelationshipType.dash);
  });

  it('ignores a direction outside the direction list', () => {
    const entities = createAndMergeRelationshipEntities({
      key: {
        id: 'r1',
        start: { direction: 16 },
        end: { direction: '1' as any },
      },
    });

    expect(entities.r1.start.direction).toBe(Direction.bottom);
    expect(entities.r1.end.direction).toBe(Direction.bottom);
  });

  it('ignores wrongly typed point fields', () => {
    const entities = createAndMergeRelationshipEntities({
      key: {
        id: 'r1',
        identification: 'true' as any,
        start: { tableId: 1 as any, x: '10' as any, columnIds: 'c1' as any },
        end: { tableId: 't2', y: 5 },
      },
    });

    const relationship = entities.r1;
    expect(relationship.identification).toBe(false);
    expect(relationship.start.tableId).toBe('');
    expect(relationship.start.x).toBe(0);
    expect(relationship.start.columnIds).toEqual([]);
    expect(relationship.end.tableId).toBe('t2');
    expect(relationship.end.y).toBe(5);
  });

  it('keeps the point defaults when start and end are missing', () => {
    const entities = createAndMergeRelationshipEntities({ key: { id: 'r1' } });

    expect(entities.r1.start).toEqual({
      tableId: '',
      columnIds: [],
      x: 0,
      y: 0,
      direction: Direction.bottom,
    });
    expect(entities.r1.end).toEqual({
      tableId: '',
      columnIds: [],
      x: 0,
      y: 0,
      direction: Direction.bottom,
    });
  });

  it('merges several relationships', () => {
    const entities = createAndMergeRelationshipEntities({
      a: { id: 'a' },
      b: { id: 'b' },
    });

    expect(Object.keys(entities).sort()).toEqual(['a', 'b']);
  });
});
