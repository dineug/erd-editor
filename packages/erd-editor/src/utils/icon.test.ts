import { describe, expect, it } from 'vite-plus/test';

import { BASE_64_ICON } from '@/components/primitives/icon/icons';
import { RelationshipType } from '@/constants/schema';
import { getRelationshipIcon } from '@/utils/icon';

describe('getRelationshipIcon', () => {
  it('maps every v3 relationship type to its base64 icon', () => {
    expect(getRelationshipIcon(RelationshipType.ZeroOne)).toBe(
      BASE_64_ICON.ZeroOne
    );
    expect(getRelationshipIcon(RelationshipType.ZeroN)).toBe(
      BASE_64_ICON.ZeroN
    );
    expect(getRelationshipIcon(RelationshipType.OneOnly)).toBe(
      BASE_64_ICON.OneOnly
    );
    expect(getRelationshipIcon(RelationshipType.OneN)).toBe(BASE_64_ICON.OneN);
  });

  it('still resolves the deprecated v2 relationship types', () => {
    expect(getRelationshipIcon(1)).toBe(BASE_64_ICON.ZeroOneN);
    expect(getRelationshipIcon(32)).toBe(BASE_64_ICON.One);
    expect(getRelationshipIcon(64)).toBe(BASE_64_ICON.N);
  });

  it('returns a data uri string', () => {
    const icon = getRelationshipIcon(RelationshipType.ZeroN);

    expect(icon).toMatch(/^data:image\/png;base64,/);
  });

  it('returns null for an unknown relationship type', () => {
    expect(getRelationshipIcon(0)).toBeNull();
    expect(getRelationshipIcon(128)).toBeNull();
    expect(getRelationshipIcon(-1)).toBeNull();
    expect(getRelationshipIcon(3)).toBeNull();
  });
});
