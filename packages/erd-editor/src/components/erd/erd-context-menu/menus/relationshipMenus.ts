import { query } from '@dineug/erd-editor-schema';

import { AppContext } from '@/components/appContext';
import { NotationIconName } from '@/components/primitives/icon/icons';
import { ReferentialAction, RelationshipType } from '@/constants/schema';
import {
  changeRelationshipOnDeleteAction,
  changeRelationshipOnUpdateAction,
  changeRelationshipTypeAction,
} from '@/engine/modules/relationship/atom.actions';
import { menuLabel } from '@/i18n/menuLabel';
import { sourceI18n } from '@/i18n/source';
import type { I18n, PlainMessageKey } from '@/i18n/translate';
import { referentialActionSupport } from '@/utils/schema-sql/utils';

import { menus as databaseMenus } from './databaseMenus';

type Menu = {
  iconName: NotationIconName;
  labelKey: PlainMessageKey;
  relationshipType: number;
};

const menus: Menu[] = [
  {
    iconName: 'ZeroOne',
    labelKey: 'common.relationshipType.zeroOne',
    relationshipType: RelationshipType.ZeroOne,
  },
  {
    iconName: 'ZeroN',
    labelKey: 'common.relationshipType.zeroN',
    relationshipType: RelationshipType.ZeroN,
  },
  {
    iconName: 'OneOnly',
    labelKey: 'common.relationshipType.oneOnly',
    relationshipType: RelationshipType.OneOnly,
  },
  {
    iconName: 'OneN',
    labelKey: 'common.relationshipType.oneN',
    relationshipType: RelationshipType.OneN,
  },
];

/** A notation's name as this menu gives it, and none for a value it does not know. */
export function relationshipTypeName(
  relationshipType: number,
  { t }: Pick<I18n, 't'>
) {
  const menu = menus.find(item => item.relationshipType === relationshipType);
  return menu ? t(menu.labelKey) : '';
}

/** The four types a relationship can take, its own one checked, named in the reader's language. */
export function createRelationshipMenus(
  { store }: AppContext,
  relationshipId?: string,
  i18n: Pick<I18n, 't'> = sourceI18n
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
      name: i18n.t(menu.labelKey),
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

/** The SQL each action is written as, which no language translates; Not set is a word of the editor's. */
const referentialActionMenus: Array<{
  name: string;
  labelKey?: PlainMessageKey;
  value: number;
}> = [
  {
    name: 'Not set',
    labelKey: 'contextMenu.notSet',
    value: ReferentialAction.none,
  },
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
  relationshipId?: string,
  i18n: Pick<I18n, 't'> = sourceI18n
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
    name: menuLabel(i18n, menu),
    note:
      database &&
      menu.value !== ReferentialAction.none &&
      !supported.includes(menu.value)
        ? i18n.t('contextMenu.notInDatabase', { database })
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
