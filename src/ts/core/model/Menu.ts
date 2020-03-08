import { ShowKey, Database, Language, Case } from "../store/Canvas";
import { Store } from "../Store";
import { uuid } from "../Helper";
import { tableAdd } from "../command/table";

export interface MenuOption {
  close?: boolean;
  show?: ShowKey;
  database?: Database;
  language?: Language;
  tableCase?: Case;
  columnCase?: Case;
}

export interface Menu {
  id: string;
  name: string;
  keymap?: string;
  icon?: string;
  base64?: boolean;
  children?: Menu[];
  option?: MenuOption;

  execute?(effect?: () => void): void;
}

export function getERDContextmenu(store: Store): Menu[] {
  return [
    {
      id: uuid(),
      icon: "table",
      name: "New Table",
      keymap: "Alt + N",
      execute() {
        console.log("New Table");
        store.dispatch(tableAdd(store));
      }
    }
  ];
}
