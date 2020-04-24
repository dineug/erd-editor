import { ShowKey, Database, Language, NameCase } from "./store/Canvas";
import { Store } from "./Store";
import { Keymap, keymapOptionToString } from "./Keymap";
import { exportPNG, exportJSON } from "./File";
import { addTable } from "./command/table";
import { addMemo } from "./command/memo";
import { changeColumnPrimaryKey } from "./command/column";
import { changeCanvasShow, changeDatabase } from "./command/canvas";

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

  execute?(root: ShadowRoot): void;
}

export function getERDContextmenu(store: Store, keymap: Keymap): Menu[] {
  const { canvasState, tableState, memoState, relationshipState } = store;
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
    {
      icon: "eye",
      name: "View Option",
      children: createShowMenus(store),
    },
    {
      icon: "database",
      name: "Database",
      children: createDatabaseMenus(store),
    },
    {
      icon: "file-export",
      name: "Export",
      children: [
        {
          name: "json",
          execute() {
            exportJSON(
              JSON.stringify(
                {
                  canvas: canvasState,
                  table: tableState,
                  memo: memoState,
                  relationship: relationshipState,
                },
                undefined,
                2
              ),
              canvasState.databaseName
            );
          },
        },
        {
          icon: "file-image",
          name: "png",
          execute(root: ShadowRoot) {
            exportPNG(root, ".vuerd-canvas", canvasState.databaseName);
          },
        },
      ],
    },
  ];
}

interface ShowMenu {
  name: string;
  showKey: ShowKey;
}
const showMenus: ShowMenu[] = [
  {
    name: "Table Comment",
    showKey: "tableComment",
  },
  {
    name: "Column Comment",
    showKey: "columnComment",
  },
  {
    name: "DataType",
    showKey: "columnDataType",
  },
  {
    name: "Default",
    showKey: "columnDefault",
  },
  {
    name: "Not Null",
    showKey: "columnNotNull",
  },
  {
    name: "Relationship",
    showKey: "relationship",
  },
];
function createShowMenus(store: Store): Menu[] {
  const { show } = store.canvasState;
  return showMenus.map((showMenu) => {
    return {
      icon: show[showMenu.showKey] ? "check" : undefined,
      name: showMenu.name,
      execute() {
        store.dispatch(changeCanvasShow(store, showMenu.showKey));
      },
      option: {
        close: false,
        show: showMenu.showKey,
      },
    };
  });
}

const databaseKeys: Database[] = [
  "MySQL",
  "MariaDB",
  "PostgreSQL",
  "Oracle",
  "MSSQL",
];
function createDatabaseMenus(store: Store): Menu[] {
  const { canvasState } = store;
  return databaseKeys.map((databaseKey) => {
    return {
      icon: canvasState.database === databaseKey ? "check" : undefined,
      name: databaseKey,
      execute() {
        store.dispatch(changeDatabase(databaseKey));
      },
      option: {
        close: false,
        database: databaseKey,
      },
    };
  });
}
