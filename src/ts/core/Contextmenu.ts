import { ShowKey, Database, Language, NameCase } from "./store/Canvas";
import { Store } from "./Store";
import { Keymap, keymapOptionToString } from "./Keymap";
import { addTable } from "./command/table";
import { addMemo } from "./command/memo";
import { changeColumnPrimaryKey } from "./command/column";

export interface MenuOption {
  close?: boolean;
  show?: ShowKey;
  database?: Database;
  language?: Language;
  tableCase?: NameCase;
  columnCase?: NameCase;
}

export interface Menu {
  name: string;
  keymap?: string;
  icon?: string;
  base64?: boolean;
  children?: Menu[];
  option?: MenuOption;

  execute?(effect?: () => void): void;
}

export function getERDContextmenu(store: Store, keymap: Keymap): Menu[] {
  return [
    {
      icon: "table",
      name: "New Table",
      keymap: keymapOptionToString(keymap.addTable[0]),
      execute() {
        store.dispatch(addTable(store));
      },
    },
    {
      icon: "sticky-note",
      name: "New Memo",
      keymap: keymapOptionToString(keymap.addMemo[0]),
      execute() {
        store.dispatch(addMemo(store));
      },
    },
    {
      icon: "key",
      name: "Primary Key",
      keymap: keymapOptionToString(keymap.primaryKey[0]),
      execute() {
        const { focusTable } = store.editorState;
        if (focusTable !== null) {
          const currentFocus = focusTable.currentFocus;
          if (currentFocus !== "tableName" && currentFocus !== "tableComment") {
            const columnId = focusTable.currentFocusId;
            store.dispatch(
              changeColumnPrimaryKey(store, focusTable.id, columnId)
            );
          }
        }
      },
    },
  ];
}
