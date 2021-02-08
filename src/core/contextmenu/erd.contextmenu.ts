import { Menu, MenuOptions } from '@@types/core/contextmenu';
import { ERDEditorContext } from '@@types/core/ERDEditorContext';
import { keymapOptionToString } from '@/core/keymap';
import { createShowMenus } from './show.contextmenu';
import { createDatabaseMenus } from './database.contextmenu';
import { createDrawRelationshipMenus } from './draw-relationship.contextmenu';

const options: MenuOptions = {
  nameWidth: 75,
  keymapWidth: 45,
};

const fileOptions: MenuOptions = {
  nameWidth: 60,
  keymapWidth: 0,
};

export function createERDMenus(context: ERDEditorContext): Menu[] {
  const { store, keymap, command } = context;
  return [
    {
      icon: {
        prefix: 'fas',
        name: 'table',
      },
      name: 'New Table',
      keymap: keymapOptionToString(keymap.addTable[0]),
      execute() {
        // store.dispatch(addTable(store));
      },
    },
    {
      icon: {
        prefix: 'fas',
        name: 'sticky-note',
      },
      name: 'New Memo',
      keymap: keymapOptionToString(keymap.addMemo[0]),
      execute() {
        store.dispatch(command.memo.addMemo$(store));
      },
    },
    {
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
        prefix: 'fas',
        name: 'database',
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
      children: [
        {
          name: 'json',
          execute() {
            // importJSON(store);
          },
        },
        {
          name: 'SQL DDL',
          execute() {
            // importSQL(context);
          },
        },
      ].map(menu => ({ ...menu, options: fileOptions })),
    },
    {
      icon: {
        prefix: 'fas',
        name: 'file-export',
      },
      name: 'Export',
      children: [
        {
          name: 'json',
          execute() {
            // exportJSON(createJsonStringify(store, 2), canvasState.databaseName);
          },
        },
        {
          name: 'SQL DDL',
          execute() {
            // exportSQLDDL(createDDL(store), canvasState.databaseName);
          },
        },
        {
          icon: {
            prefix: 'fas',
            name: 'file-image',
          },
          name: 'png',
          execute() {
            // exportPNG(root, '.vuerd-canvas', canvasState.databaseName);
          },
        },
      ].map(menu => ({ ...menu, options: fileOptions })),
    },
  ].map(menu => ({ ...menu, options }));
}
