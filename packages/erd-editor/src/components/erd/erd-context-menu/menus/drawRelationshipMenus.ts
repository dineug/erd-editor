import { AppContext } from '@/components/appContext';
import { NotationIconName } from '@/components/primitives/icon/icons';
import { RelationshipType } from '@/constants/schema';
import { drawStartRelationshipAction$ } from '@/engine/modules/editor/generator.actions';
import type { PlainMessageKey } from '@/i18n/translate';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

type Menu = {
  iconName: NotationIconName;
  name: string;
  labelKey?: PlainMessageKey;
  keyBindingName: KeyBindingName;
  relationshipType: number;
};

export const menus: Menu[] = [
  {
    iconName: 'ZeroOne',
    name: 'Zero One',
    labelKey: 'common.relationshipType.zeroOne',
    keyBindingName: KeyBindingName.relationshipZeroOne,
    relationshipType: RelationshipType.ZeroOne,
  },
  {
    iconName: 'ZeroN',
    name: 'Zero N',
    labelKey: 'common.relationshipType.zeroN',
    keyBindingName: KeyBindingName.relationshipZeroN,
    relationshipType: RelationshipType.ZeroN,
  },
  {
    iconName: 'OneOnly',
    name: 'One Only',
    labelKey: 'common.relationshipType.oneOnly',
    keyBindingName: KeyBindingName.relationshipOneOnly,
    relationshipType: RelationshipType.OneOnly,
  },
  {
    iconName: 'OneN',
    name: 'One N',
    labelKey: 'common.relationshipType.oneN',
    keyBindingName: KeyBindingName.relationshipOneN,
    relationshipType: RelationshipType.OneN,
  },
];

export function createDrawRelationshipMenus(
  { store, keyBindingMap }: AppContext,
  onClose: () => void
) {
  return menus.map(menu => ({
    iconName: menu.iconName,
    name: menu.name,
    labelKey: menu.labelKey,
    shortcut: keyBindingMap[menu.keyBindingName][0]?.shortcut,
    onClick: () => {
      store.dispatch(drawStartRelationshipAction$(menu.relationshipType));
      onClose();
    },
  }));
}
