import { Menu, MenuOptions } from '@@types/core/contextmenu';
import { ERDEditorContext } from '@@types/core/ERDEditorContext';
import { RelationshipKeymapName } from '@@types/core/keymap';
import { RelationshipType } from '@@types/engine/store/relationship.state';
import { keymapOptionToString } from '@/core/keymap';
import { getBase64Icon } from '@/core/icon';

interface RelationshipMenu {
  name: string;
  relationshipType: RelationshipType;
  keymapName: RelationshipKeymapName;
}

export const relationshipMenus: RelationshipMenu[] = [
  {
    name: 'Zero One N',
    relationshipType: 'ZeroOneN',
    keymapName: 'relationshipZeroOneN',
  },
  {
    name: 'Zero One',
    relationshipType: 'ZeroOne',
    keymapName: 'relationshipZeroOne',
  },
  {
    name: 'Zero N',
    relationshipType: 'ZeroN',
    keymapName: 'relationshipZeroN',
  },
  {
    name: 'One Only',
    relationshipType: 'OneOnly',
    keymapName: 'relationshipOneOnly',
  },
  {
    name: 'One N',
    relationshipType: 'OneN',
    keymapName: 'relationshipOneN',
  },
  {
    name: 'One',
    relationshipType: 'One',
    keymapName: 'relationshipOne',
  },
  {
    name: 'N',
    relationshipType: 'N',
    keymapName: 'relationshipN',
  },
];

const options: MenuOptions = {
  nameWidth: 70,
  keymapWidth: 75,
};

export const createDrawRelationshipMenus = ({
  keymap,
}: ERDEditorContext): Menu[] =>
  relationshipMenus.map(relationshipMenu => ({
    iconBase64: getBase64Icon(relationshipMenu.relationshipType),
    name: relationshipMenu.name,
    keymap: keymapOptionToString(keymap[relationshipMenu.keymapName][0]),
    execute() {
      // store.dispatch(
      //   drawStartRelationship(relationshipMenu.relationshipType)
      // );
    },
    options,
  }));
