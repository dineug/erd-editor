import { query } from '@dineug/erd-editor-schema';

import { AppContext } from '@/components/appContext';
import { NotationIconName } from '@/components/primitives/icon/icons';
import { ReferentialAction, RelationshipType } from '@/constants/schema';
import {
  changeRelationshipOnDeleteAction,
  changeRelationshipOnUpdateAction,
  changeRelationshipTypeAction,
} from '@/engine/modules/relationship/atom.actions';
import { referentialActionSupport } from '@/utils/schema-sql/utils';

import { menus as databaseMenus } from './databaseMenus';

type Menu = {
  iconName: NotationIconName;
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
      },
    };
  });
}

export type ReferentialActionField = 'onDelete' | 'onUpdate';

const referentialActionMenus: Array<{ name: string; value: number }> = [
  { name: 'Not set', value: ReferentialAction.none },
  { name: 'NO ACTION', value: ReferentialAction.noAction },
  { name: 'CASCADE', value: ReferentialAction.cascade },
  { name: 'SET NULL', value: ReferentialAction.setNull },
  { name: 'SET DEFAULT', value: ReferentialAction.setDefault },
  { name: 'RESTRICT', value: ReferentialAction.restrict },
];

const changeReferentialAction = {
  onDelete: changeRelationshipOnDeleteAction,
  onUpdate: changeRelationshipOnUpdateAction,
} as const;

/**
 * The ON DELETE or ON UPDATE choices of a relationship, its own one checked.
 * One the current database's DDL would drop stays choosable, with a note.
 */
export function createReferentialActionMenus(
  { store }: AppContext,
  field: ReferentialActionField,
  relationshipId?: string
) {
  if (!relationshipId) return [];

  const { collections, settings } = store.state;
  const relationship = query(collections)
    .collection('relationshipEntities')
    .selectById(relationshipId);
  if (!relationship) return [];

  const supported = referentialActionSupport(settings.database)[field];
  const database = databaseMenus.find(
    menu => menu.value === settings.database
  )?.name;

  return referentialActionMenus.map(menu => ({
    checked: menu.value === relationship[field],
    name: menu.name,
    note:
      database &&
      menu.value !== ReferentialAction.none &&
      !supported.includes(menu.value)
        ? `not in ${database}`
        : null,
    onClick: () => {
      store.dispatch(
        changeReferentialAction[field]({
          id: relationshipId,
          value: menu.value,
        })
      );
    },
  }));
}
