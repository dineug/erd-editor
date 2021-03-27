import { Menu, MenuOptions } from '@@types/core/contextmenu';
import { ERDEditorContext } from '@@types/core/ERDEditorContext';
import { Relationship } from '@@types/engine/store/relationship.state';
import { removeRelationship } from '@/engine/command/relationship.cmd.helper';
import { createSingleRelationship } from './singleRelationship.menu';

const defaultOptions: MenuOptions = {
  nameWidth: 100,
  keymapWidth: 0,
};

export function createRelationshipMenus(
  context: ERDEditorContext,
  relationship: Relationship
): Menu[] {
  const { store } = context;
  return [
    {
      icon: {
        prefix: 'mdi',
        name: 'vector-line',
        size: 18,
      },
      name: 'Relationship Type',
      children: createSingleRelationship(context, relationship),
    },
    {
      name: 'Delete',
      execute: () => store.dispatch(removeRelationship([relationship.id])),
    },
  ].map(menu => ({ ...menu, options: { ...defaultOptions } }));
}
