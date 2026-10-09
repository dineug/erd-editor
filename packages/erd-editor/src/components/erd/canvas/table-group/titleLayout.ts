import { getCellTextHeight } from '@/components/erd/canvas/table/cellLayout';
import { TABLE_GROUP_TITLE_HEIGHT } from '@/constants/layout';

/**
 * The box a group's name is centred in, down from the top of its title bar on
 * a whole pixel. The scene hands konva this box with verticalAlign middle and
 * the name editor gives its input the same one, so the two baselines meet.
 *
 * @example
 * const { y, height } = getTableGroupNameBox();
 */
export function getTableGroupNameBox(): { y: number; height: number } {
  const height = getCellTextHeight();
  return { y: Math.round((TABLE_GROUP_TITLE_HEIGHT - height) / 2), height };
}
