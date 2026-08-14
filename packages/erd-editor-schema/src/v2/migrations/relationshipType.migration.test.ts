import { describe, expect, it } from 'vitest';

import { migrationRelationshipType } from '@/v2/migrations/relationshipType.migration';
import { RelationshipTypeList } from '@/v2/schema/relationshipEntity';

describe('migrationRelationshipType', () => {
  it.each([
    ['ZeroOneN', 'ZeroN'],
    ['One', 'OneOnly'],
    ['N', 'OneN'],
  ] as const)('migrates the legacy type %s to %s', (input, expected) => {
    expect(migrationRelationshipType(input)).toBe(expected);
  });

  it.each(['ZeroOne', 'ZeroN', 'OneOnly', 'OneN'] as const)(
    'keeps the already migrated type %s as is',
    input => {
      expect(migrationRelationshipType(input)).toBe(input);
    }
  );

  it('returns unknown values untouched', () => {
    expect(migrationRelationshipType('Unknown' as any)).toBe('Unknown');
    expect(migrationRelationshipType(undefined as any)).toBeUndefined();
  });

  it('is idempotent for every declared relationship type', () => {
    for (const type of RelationshipTypeList) {
      const once = migrationRelationshipType(type as any);
      expect(migrationRelationshipType(once)).toBe(once);
    }
  });
});
