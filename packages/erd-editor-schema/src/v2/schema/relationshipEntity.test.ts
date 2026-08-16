import { describe, expect, it } from 'vite-plus/test';

import {
  Direction,
  DirectionList,
  Relationship,
  RelationshipEntity,
  RelationshipPoint,
  RelationshipType,
  RelationshipTypeList,
  StartRelationshipType,
  StartRelationshipTypeList,
} from '@/v2/schema/relationshipEntity';

describe('v2/schema/relationshipEntity', () => {
  describe('RelationshipType', () => {
    it('exposes the seven cardinality variants', () => {
      expect(RelationshipType).toEqual({
        ZeroOneN: 'ZeroOneN',
        ZeroOne: 'ZeroOne',
        ZeroN: 'ZeroN',
        OneOnly: 'OneOnly',
        OneN: 'OneN',
        One: 'One',
        N: 'N',
      });
    });

    it('exposes RelationshipTypeList in declaration order', () => {
      expect(RelationshipTypeList).toEqual([
        'ZeroOneN',
        'ZeroOne',
        'ZeroN',
        'OneOnly',
        'OneN',
        'One',
        'N',
      ]);
    });

    it('keeps the list length in sync with the map', () => {
      expect(RelationshipTypeList).toHaveLength(
        Object.keys(RelationshipType).length
      );
    });

    it('does not contain lowercase aliases', () => {
      expect(RelationshipTypeList.includes('one')).toBe(false);
      expect(RelationshipTypeList.includes(RelationshipType.One)).toBe(true);
    });
  });

  describe('StartRelationshipType', () => {
    it('only supports Ring and Dash', () => {
      expect(StartRelationshipType).toEqual({ Ring: 'Ring', Dash: 'Dash' });
      expect(StartRelationshipTypeList).toEqual(['Ring', 'Dash']);
    });
  });

  describe('Direction', () => {
    it('exposes the four edge directions', () => {
      expect(DirectionList).toEqual(['left', 'right', 'top', 'bottom']);
    });

    it('is an identity map', () => {
      for (const [key, value] of Object.entries(Direction)) {
        expect(value).toBe(key);
      }
    });

    it('pairs opposite directions inside the list', () => {
      expect(DirectionList.indexOf(Direction.left)).toBeLessThan(
        DirectionList.indexOf(Direction.right)
      );
      expect(DirectionList).toContain(Direction.bottom);
    });
  });

  describe('RelationshipEntity shape', () => {
    it('accepts a fully populated relationship', () => {
      const start: RelationshipPoint = {
        tableId: 'table-1',
        columnIds: ['col-1'],
        x: 10,
        y: 20,
        direction: Direction.right,
      };
      const end: RelationshipPoint = {
        tableId: 'table-2',
        columnIds: ['col-2', 'col-3'],
        x: 110,
        y: 220,
        direction: Direction.left,
      };
      const relationship: Relationship = {
        id: 'rel-1',
        identification: true,
        relationshipType: RelationshipType.ZeroOneN,
        startRelationshipType: StartRelationshipType.Dash,
        start,
        end,
        constraintName: 'fk_table2_table1',
        visible: true,
      };
      const entity: RelationshipEntity = { relationships: [relationship] };

      expect(entity.relationships).toHaveLength(1);
      expect(entity.relationships[0].start.direction).toBe('right');
      expect(entity.relationships[0].end.columnIds).toHaveLength(2);
      expect(RelationshipTypeList).toContain(
        entity.relationships[0].relationshipType
      );
      expect(StartRelationshipTypeList).toContain(
        entity.relationships[0].startRelationshipType
      );
    });

    it('treats startRelationshipType, constraintName and visible as optional', () => {
      const relationship: Relationship = {
        id: 'rel-2',
        identification: false,
        relationshipType: RelationshipType.One,
        start: {
          tableId: 'table-1',
          columnIds: [],
          x: 0,
          y: 0,
          direction: Direction.top,
        },
        end: {
          tableId: 'table-1',
          columnIds: [],
          x: 0,
          y: 0,
          direction: Direction.bottom,
        },
      };
      const entity: RelationshipEntity = { relationships: [relationship] };

      expect(entity.relationships[0].startRelationshipType).toBeUndefined();
      expect(entity.relationships[0].constraintName).toBeUndefined();
      expect(entity.relationships[0].visible).toBeUndefined();
      expect(entity.relationships[0].start.tableId).toBe(
        entity.relationships[0].end.tableId
      );
    });

    it('supports an empty relationship collection', () => {
      const entity: RelationshipEntity = { relationships: [] };
      expect(entity.relationships).toEqual([]);
    });
  });
});
