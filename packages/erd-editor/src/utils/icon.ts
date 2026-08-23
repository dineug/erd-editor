import { getIcon } from '@/components/primitives/icon/icons';
import { RelationshipType } from '@/constants/schema';

// 1, 32 and 64 are the RelationshipType members left commented out in
// @dineug/erd-editor-schema; they have no constant, so the bits are spelled out.
const relationshipTypeToIconName: Record<number, string> = {
  [1]: 'ZeroOneN',
  [RelationshipType.ZeroOne]: 'ZeroOne',
  [RelationshipType.ZeroN]: 'ZeroN',
  [RelationshipType.OneOnly]: 'OneOnly',
  [RelationshipType.OneN]: 'OneN',
  [32]: 'One',
  [64]: 'N',
};

export function getRelationshipIcon(relationshipType: number): string | null {
  const iconName = relationshipTypeToIconName[relationshipType];
  const icon = getIcon('base64', iconName);
  if (!icon) return null;

  const [width, height, , , d] = icon.icon;
  return d;
}
