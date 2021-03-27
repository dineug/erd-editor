import { Menu, MenuOptions } from '@@types/core/contextmenu';
import { ERDEditorContext } from '@@types/core/ERDEditorContext';
import { Relationship } from '@@types/engine/store/relationship.state';
import { relationshipMenus } from './drawRelationship.menu';
import { changeRelationshipType } from '@/engine/command/relationship.cmd.helper';

const defaultOptions: MenuOptions = {
  nameWidth: 70,
  keymapWidth: 0,
  close: false,
};

export const createSingleRelationship = (
  { store }: ERDEditorContext,
  relationship: Relationship
): Menu[] =>
  relationshipMenus.map(relationshipMenu => ({
    icon:
      relationship.relationshipType === relationshipMenu.relationshipType
        ? {
            prefix: 'fas',
            name: 'check',
          }
        : undefined,
    name: relationshipMenu.name,
    execute: () =>
      store.dispatch(
        changeRelationshipType(
          relationship.id,
          relationshipMenu.relationshipType
        )
      ),
    options: {
      ...defaultOptions,
    },
  }));
