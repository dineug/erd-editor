import { AppContext } from '@/components/appContext';
import { RelationshipType } from '@/constants/schema';
import { changeRelationshipTypeAction } from '@/engine/modules/relationship/atom.actions';
import { query } from '@/utils/collection/query';

type Menu = {
  iconName: string;
  name: string;
  relationshipType: number;
};

const menus: Menu[] = [
  {
    iconName: 'ZeroOne',
    name: 'Zero One',
    relationshipType: RelationshipType.ZeroOne,
  },
  {
    iconName: 'ZeroN',
    name: 'Zero N',
    relationshipType: RelationshipType.ZeroN,
  },
  {
    iconName: 'OneOnly',
    name: 'One Only',
    relationshipType: RelationshipType.OneOnly,
  },
  {
    iconName: 'OneN',
    name: 'One N',
    relationshipType: RelationshipType.OneN,
  },
];

export function createRelationshipMenus(
  { store }: AppContext,
  onClose: () => void,
  relationshipId?: string
) {
  if (!relationshipId) return [];

  const { collections } = store.state;
  const relationship = query(collections)
    .collection('relationshipEntities')
    .selectById(relationshipId);
  if (!relationship) return [];

  return menus.map(menu => {
    const checked = menu.relationshipType === relationship.relationshipType;

    return {
      checked,
      iconName: menu.iconName,
      name: menu.name,
      onClick: () => {
        store.dispatch(
          changeRelationshipTypeAction({
            id: relationshipId,
            value: menu.relationshipType,
          })
        );
        onClose();
      },
    };
  });
}
