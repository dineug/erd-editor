import { describe, expect, it } from 'vitest';

import {
  Direction,
  DirectionList,
  Relationship,
  RelationshipPoint,
  RelationshipType,
  RelationshipTypeList,
  StartRelationshipType,
  StartRelationshipTypeList,
} from '@/v3/schema/relationship.entity';

describe('v3/schema/relationship.entity', () => {
  describe('RelationshipType', () => {
    it('only exposes the four active cardinalities', () => {
      expect(RelationshipType).toEqual({
        ZeroOne: 2,
        ZeroN: 4,
        OneOnly: 8,
        OneN: 16,
      });
      expect(Object.keys(RelationshipType)).toHaveLength(4);
    });

    it('leaves the 0b1 slot unused because ZeroOneN is commented out', () => {
      expect(RelationshipTypeList).not.toContain(1);
      expect(Math.min(...RelationshipTypeList)).toBe(2);
    });

    it('lists the values in declaration order without duplicates', () => {
      expect(RelationshipTypeList).toEqual([2, 4, 8, 16]);
      expect(new Set(RelationshipTypeList).size).toBe(
        RelationshipTypeList.length
      );
    });

    it('composes into a mask that keeps each cardinality testable', () => {
      const mask = RelationshipType.ZeroN | RelationshipType.OneN;

      expect(mask).toBe(20);
      expect(Boolean(mask & RelationshipType.ZeroN)).toBe(true);
      expect(Boolean(mask & RelationshipType.ZeroOne)).toBe(false);
    });
  });

  describe('StartRelationshipType', () => {
    it('exposes ring and dash as single bits', () => {
      expect(StartRelationshipType).toEqual({ ring: 1, dash: 2 });
      expect(StartRelationshipTypeList).toEqual([1, 2]);
    });

    it('keeps ring and dash mutually distinguishable', () => {
      expect(StartRelationshipType.ring & StartRelationshipType.dash).toBe(0);
    });
  });

  describe('Direction', () => {
    it('exposes the four edge directions as single bits', () => {
      expect(Direction).toEqual({ left: 1, right: 2, top: 4, bottom: 8 });
      expect(DirectionList).toEqual([1, 2, 4, 8]);
    });

    it('resolves a direction flag back to its name', () => {
      const nameOf = (flag: number) =>
        Object.keys(Direction).find(
          key => Direction[key as keyof typeof Direction] === flag
        );

      expect(nameOf(Direction.bottom)).toBe('bottom');
      expect(nameOf(16)).toBeUndefined();
    });
  });

  it('describes a relationship built from the exported constants', () => {
    const start: RelationshipPoint = {
      tableId: 'table-a',
      columnIds: ['column-a'],
      x: 10,
      y: 20,
      direction: Direction.right,
    };
    const end: RelationshipPoint = {
      tableId: 'table-b',
      columnIds: ['column-b', 'column-c'],
      x: 200,
      y: 20,
      direction: Direction.left,
    };
    const relationship: Relationship = {
      id: 'relationship-1',
      identification: true,
      relationshipType: RelationshipType.OneN,
      startRelationshipType: StartRelationshipType.dash,
      start,
      end,
      meta: { updateAt: 2, createAt: 1 },
    };

    expect(RelationshipTypeList).toContain(relationship.relationshipType);
    expect(StartRelationshipTypeList).toContain(
      relationship.startRelationshipType
    );
    expect(DirectionList).toContain(relationship.start.direction);
    expect(relationship.end.columnIds).toHaveLength(2);
    expect(relationship.meta.updateAt).toBeGreaterThan(
      relationship.meta.createAt
    );
  });
});
