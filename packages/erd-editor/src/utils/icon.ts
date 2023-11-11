import { getIcon } from '@/components/primitives/icon/icons';
import { RelationshipType } from '@/constants/schema';

const relationshipTypeToIconName: Record<number, string> = {
  [0b0000000000000000000000000000001]: 'ZeroOneN',
  [RelationshipType.ZeroOne]: 'ZeroOne',
  [RelationshipType.ZeroN]: 'ZeroN',
  [RelationshipType.OneOnly]: 'OneOnly',
  [RelationshipType.OneN]: 'OneN',
  [0b0000000000000000000000000100000]: 'One',
  [0b0000000000000000000000001000000]: 'N',
};

export function getRelationshipIcon(relationshipType: number): string | null {
  const iconName = relationshipTypeToIconName[relationshipType];
  const icon = getIcon('base64', iconName);
  if (!icon) return null;

  const [width, height, , , d] = icon.icon;
  return d;
}
