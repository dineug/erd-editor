import {
  colorRelationship,
  removeRelationship,
} from '@/engine/command/relationship.cmd.helper';
import { Menu, MenuOptions } from '@@types/core/contextmenu';
import { ERDEditorContext } from '@@types/core/ERDEditorContext';
import { Relationship } from '@@types/engine/store/relationship.state';

import { createSingleRelationship } from './singleRelationship.menu';

const defaultOptions: MenuOptions = {
  nameWidth: 110,
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
    {
      name: 'Color',
      execute: () => store.dispatch(colorRelationship(relationship.id, 'red')),
    },
  ].map(menu => ({ ...menu, options: { ...defaultOptions } }));
}
