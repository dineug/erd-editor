import { AppContext } from '@/components/appContext';
import { IconName } from '@/components/primitives/icon/icons';
import { TablePlacement } from '@/constants/tablePlacement';
import type { PlainMessageKey } from '@/i18n/translate';
import { openAutomaticTablePlacementAction } from '@/utils/emitter';

type Menu = {
  name: string;
  labelKey?: PlainMessageKey;
  iconName: IconName;
  placement: TablePlacement;
};

export const menus: Menu[] = [
  {
    name: 'Force',
    labelKey: 'common.placement.force',
    iconName: 'atom',
    placement: TablePlacement.force,
  },
  {
    name: 'Flow',
    labelKey: 'common.placement.flow',
    iconName: 'waypoints',
    placement: TablePlacement.flow,
  },
  {
    name: 'Tree - vertical',
    labelKey: 'common.placement.treeVertical',
    iconName: 'network',
    placement: TablePlacement.layeredVertical,
  },
  {
    name: 'Tree - horizontal',
    labelKey: 'common.placement.treeHorizontal',
    iconName: 'network',
    placement: TablePlacement.layeredHorizontal,
  },
];

/**
 * The placements the author can ask for. Each one emits the same action, and
 * the editor reads the placement to decide between the preview it watches
 * settle and the layout ELK answers in one go.
 *
 * @example
 * createTablePlacementMenus(app.value, props.onClose).map(menu => ...);
 */
export function createTablePlacementMenus(
  { emitter }: AppContext,
  onClose: () => void
) {
  return menus.map(({ name, labelKey, iconName, placement }) => ({
    name,
    labelKey,
    iconName,
    onClick: () => {
      emitter.emit(openAutomaticTablePlacementAction({ placement }));
      onClose();
    },
  }));
}
