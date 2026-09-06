import { AppContext } from '@/components/appContext';
import { IconName } from '@/components/primitives/icon/icons';
import { TablePlacement } from '@/constants/tablePlacement';
import { openAutomaticTablePlacementAction } from '@/utils/emitter';

type Menu = {
  name: string;
  iconName: IconName;
  placement: TablePlacement;
};

export const menus: Menu[] = [
  {
    name: 'Force',
    iconName: 'atom',
    placement: TablePlacement.force,
  },
  {
    name: 'Flow',
    iconName: 'waypoints',
    placement: TablePlacement.flow,
  },
  {
    name: 'Tree - vertical',
    iconName: 'align-vertical-distribute-center',
    placement: TablePlacement.layeredVertical,
  },
  {
    name: 'Tree - horizontal',
    iconName: 'align-horizontal-distribute-center',
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
  return menus.map(({ name, iconName, placement }) => ({
    name,
    iconName,
    onClick: () => {
      emitter.emit(openAutomaticTablePlacementAction({ placement }));
      onClose();
    },
  }));
}
