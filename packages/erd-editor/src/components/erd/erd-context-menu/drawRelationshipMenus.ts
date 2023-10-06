import { SchemaV3Constants } from '@dineug/erd-editor-schema';

import { AppContext } from '@/components/context';
import { KeyBindingName } from '@/keyboard-shortcut';

type Menu = {
  iconName: string;
  name: string;
  keyBindingName: KeyBindingName;
  relationshipType: number;
};

const menus: Menu[] = [
  {
    iconName: 'ZeroOne',
    name: 'Zero One',
    keyBindingName: KeyBindingName.relationshipZeroOne,
    relationshipType: SchemaV3Constants.RelationshipType.ZeroOne,
  },
  {
    iconName: 'ZeroN',
    name: 'Zero N',
    keyBindingName: KeyBindingName.relationshipZeroN,
    relationshipType: SchemaV3Constants.RelationshipType.ZeroN,
  },
  {
    iconName: 'OneOnly',
    name: 'One Only',
    keyBindingName: KeyBindingName.relationshipOneOnly,
    relationshipType: SchemaV3Constants.RelationshipType.OneOnly,
  },
  {
    iconName: 'OneN',
    name: 'One N',
    keyBindingName: KeyBindingName.relationshipOneN,
    relationshipType: SchemaV3Constants.RelationshipType.OneN,
  },
];

export function createDrawRelationshipMenus(
  { store, keyBindingMap }: AppContext,
  onClose: () => void
) {
  return menus.map(menu => ({
    iconName: menu.iconName,
    name: menu.name,
    shortcut: keyBindingMap[menu.keyBindingName][0]?.shortcut,
    onClick: () => {
      // TODO: drawStartRelationship$
      console.log('drawStartRelationship$', menu.relationshipType);
      onClose();
    },
  }));
}
