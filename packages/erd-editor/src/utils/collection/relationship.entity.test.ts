import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  Direction,
  RelationshipType,
  StartRelationshipType,
} from '@/constants/schema';
import { createRelationship } from '@/utils/collection/relationship.entity';

describe('createRelationship', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a relationship filled with defaults when no value is given', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-02T03:04:05.000Z'));
    const now = Date.now();

    const relationship = createRelationship();

    expect(relationship.identification).toBe(false);
    expect(relationship.relationshipType).toBe(RelationshipType.ZeroN);
    expect(relationship.startRelationshipType).toBe(StartRelationshipType.dash);
    expect(relationship.start).toEqual({
      tableId: '',
      columnIds: [],
      x: 0,
      y: 0,
      direction: Direction.bottom,
    });
    expect(relationship.end).toEqual({
      tableId: '',
      columnIds: [],
      x: 0,
      y: 0,
      direction: Direction.bottom,
    });
    expect(relationship.meta).toEqual({ updateAt: now, createAt: now });
    expect(typeof relationship.id).toBe('string');
    expect(relationship.id.length).toBeGreaterThan(0);
  });

  it('generates a unique id per call', () => {
    const a = createRelationship();
    const b = createRelationship();

    expect(a.id).not.toBe(b.id);
  });

  it('deep merges start and end vertices independently', () => {
    const relationship = createRelationship({
      id: 'relationship-1',
      identification: true,
      relationshipType: RelationshipType.OneOnly,
      startRelationshipType: StartRelationshipType.ring,
      start: {
        tableId: 'table-1',
        columnIds: ['column-1'],
        x: 10,
        direction: Direction.right,
      },
      end: {
        tableId: 'table-2',
        columnIds: ['column-2', 'column-3'],
        y: 20,
      },
    });

    expect(relationship.id).toBe('relationship-1');
    expect(relationship.identification).toBe(true);
    expect(relationship.relationshipType).toBe(RelationshipType.OneOnly);
    expect(relationship.startRelationshipType).toBe(StartRelationshipType.ring);
    expect(relationship.start).toEqual({
      tableId: 'table-1',
      columnIds: ['column-1'],
      x: 10,
      y: 0,
      direction: Direction.right,
    });
    expect(relationship.end).toEqual({
      tableId: 'table-2',
      columnIds: ['column-2', 'column-3'],
      x: 0,
      y: 20,
      direction: Direction.bottom,
    });
  });

  it('clones the given column id arrays', () => {
    const columnIds = ['column-1'];
    const relationship = createRelationship({ start: { columnIds } });

    columnIds.push('column-2');

    expect(relationship.start.columnIds).toEqual(['column-1']);
  });

  it('treats an explicitly undefined value as no value', () => {
    const relationship = createRelationship(undefined);

    expect(relationship.relationshipType).toBe(RelationshipType.ZeroN);
    expect(relationship.end.direction).toBe(Direction.bottom);
  });
});
