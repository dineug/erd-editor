import { TABLE_GROUP_TITLE_PADDING } from '@/components/erd/canvas/sceneTokens';
import { getCellTextHeight } from '@/components/erd/canvas/table/cellLayout';
import {
  TABLE_GROUP_TITLE_HEIGHT,
  TABLE_HEADER_ICON_GAP,
  TABLE_HEADER_ICON_SIZE,
} from '@/constants/layout';

/** The group icon before the name, at the table header icon's size and gap. */
export const TABLE_GROUP_ICON_SIZE = TABLE_HEADER_ICON_SIZE;

/** Where the name starts along the title bar, past the icon and its gap. */
export const TABLE_GROUP_NAME_X =
  TABLE_GROUP_TITLE_PADDING + TABLE_GROUP_ICON_SIZE + TABLE_HEADER_ICON_GAP;

/**
 * The box a group's name is centred in, down from the top of its title bar on
 * a whole pixel. The scene hands konva this box with verticalAlign middle and
 * the name editor gives its input the same one, so the two baselines meet.
 *
 * @example
 * const { x, y, width, height } = getTableGroupNameBox(box.width);
 */
export function getTableGroupNameBox(barWidth = 0): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const height = getCellTextHeight();
  return {
    x: TABLE_GROUP_NAME_X,
    y: Math.round((TABLE_GROUP_TITLE_HEIGHT - height) / 2),
    width: Math.max(
      barWidth - TABLE_GROUP_NAME_X - TABLE_GROUP_TITLE_PADDING,
      0
    ),
    height,
  };
}

/**
 * Where the group icon stands on the title bar: the bar's padding in, centred
 * down the bar on a whole pixel, as the table header centres its icon.
 *
 * @example
 * const { x, y, size } = getTableGroupIconBox();
 */
export function getTableGroupIconBox(): { x: number; y: number; size: number } {
  return {
    x: TABLE_GROUP_TITLE_PADDING,
    y: Math.round((TABLE_GROUP_TITLE_HEIGHT - TABLE_GROUP_ICON_SIZE) / 2),
    size: TABLE_GROUP_ICON_SIZE,
  };
}
