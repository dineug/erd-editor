import { ShowKey, Database, Language, Case } from "./store/Canvas";
import { Store } from "./Store";
import { Keymap, keymapOptionToString } from "./Keymap";
import { addTable } from "./command/table";

export interface MenuOption {
  close?: boolean;
  show?: ShowKey;
  database?: Database;
  language?: Language;
  tableCase?: Case;
  columnCase?: Case;
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
  const menu: { [key: string]: Menu } = {
    newTable: {
      icon: "table",
      name: "New Table",
      keymap: keymapOptionToString(keymap.addTable[0]),
      execute() {
        store.dispatch(addTable(store));
      }
    }
  };
  return Object.values(menu);
}
