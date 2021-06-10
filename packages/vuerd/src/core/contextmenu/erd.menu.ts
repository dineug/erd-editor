import { keymapOptionsToString, keymapOptionToString } from '@/core/keymap';
import { addMemo$ } from '@/engine/command/memo.cmd.helper';
import { addTable$ } from '@/engine/command/table.cmd.helper';
import { Menu, MenuOptions } from '@@types/core/contextmenu';
import { ERDEditorContext } from '@@types/core/ERDEditorContext';

import { createDatabaseMenus } from './database.menu';
import { createDrawRelationshipMenus } from './drawRelationship.menu';
import { createExportMenus } from './export.menu';
import { createImportMenus } from './import.menu';
import { createShowMenus } from './show.menu';

const defaultOptions: MenuOptions = {
  nameWidth: 75,
  keymapWidth: 50,
};

export function createERDMenus(
  context: ERDEditorContext,
  canvas: Element
): Menu[] {
  const { store, keymap } = context;
  return [
    {
      icon: {
        prefix: 'fas',
        name: 'table',
      },
      name: 'New Table',
      keymap: keymapOptionToString(keymap.addTable[0]),
      keymapTooltip: keymapOptionsToString(keymap.addTable),
      execute: () => store.dispatch(addTable$(store)),
    },
    {
      icon: {
        prefix: 'fas',
        name: 'sticky-note',
      },
      name: 'New Memo',
      keymap: keymapOptionToString(keymap.addMemo[0]),
      keymapTooltip: keymapOptionsToString(keymap.addMemo),
      execute: () => store.dispatch(addMemo$(store)),
    },
    {
      icon: {
        prefix: 'mdi',
        name: 'vector-line',
        size: 18,
      },
      name: 'Relationship',
      children: createDrawRelationshipMenus(context),
    },
    {
      icon: {
        prefix: 'fas',
        name: 'eye',
      },
      name: 'View Option',
      children: createShowMenus(context),
    },
    {
      icon: {
        prefix: 'mdi',
        name: 'database',
        size: 18,
      },
      name: 'Database',
      children: createDatabaseMenus(context),
    },
    {
      icon: {
        prefix: 'fas',
        name: 'file-import',
      },
      name: 'Import',
      children: createImportMenus(context),
    },
    {
      icon: {
        prefix: 'fas',
        name: 'file-export',
      },
      name: 'Export',
      children: createExportMenus(context, canvas),
    },
  ].map(menu => ({ ...menu, options: { ...defaultOptions } }));
}
