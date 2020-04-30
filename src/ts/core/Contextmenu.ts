import { ShowKey, Database, Language, NameCase } from "./store/Canvas";
import { Store } from "./Store";
import { Keymap, keymapOptionToString, RelationshipKeymapName } from "./Keymap";
import {
  exportPNG,
  exportJSON,
  importJSON,
  importSQL,
  jsonFormat,
} from "./File";
import { getBase64Icon } from "./Icon";
import { addTable } from "./command/table";
import { addMemo } from "./command/memo";
import { changeColumnPrimaryKey } from "./command/column";
import {
  changeCanvasShow,
  changeDatabase,
  changeLanguage,
  changeTableCase,
  changeColumnCase,
} from "./command/canvas";
import { drawStartRelationship } from "./command/editor";
import {
  changeRelationshipType,
  removeRelationship,
} from "./command/relationship";
import { Relationship, RelationshipType } from "./store/Relationship";
import { Helper } from "./Helper";
import { EventBus } from "./Event";
import { EditorContext } from "./EditorContext";

export interface MenuOption {
  close?: boolean;
  showKey?: ShowKey;
  database?: Database;
  language?: Language;
  tableCase?: NameCase;
  columnCase?: NameCase;
  relationshipType?: RelationshipType;
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

export function createContextmenuERD(context: EditorContext): Menu[] {
  const { store, keymap } = context;
  const { canvasState } = store;
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
      name: "Relationship",
      children: createRelationshipMenus(store, keymap),
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
      icon: "file-import",
      name: "Import",
      children: [
        {
          name: "json",
          execute() {
            importJSON(store);
          },
        },
        {
          name: "SQL DDL MySQL",
          execute() {
            importSQL(context, "MySQL");
          },
        },
        {
          name: "SQL DDL MariaDB",
          execute() {
            importSQL(context, "MariaDB");
          },
        },
      ],
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
                jsonFormat(store),
                (key, value) => {
                  if (key === "_show") {
                    return undefined;
                  }
                  return value;
                },
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
        showKey: showMenu.showKey,
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
export function createDatabaseMenus(store: Store): Menu[] {
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

interface RelationshipMenu {
  name: string;
  relationshipType: RelationshipType;
  keymapName: RelationshipKeymapName;
}
export const relationshipMenus: RelationshipMenu[] = [
  {
    name: "Zero One N",
    relationshipType: "ZeroOneN",
    keymapName: "relationshipZeroOneN",
  },
  {
    name: "Zero One",
    relationshipType: "ZeroOne",
    keymapName: "relationshipZeroOne",
  },
  {
    name: "Zero N",
    relationshipType: "ZeroN",
    keymapName: "relationshipZeroN",
  },
  {
    name: "One Only",
    relationshipType: "OneOnly",
    keymapName: "relationshipOneOnly",
  },
  {
    name: "One N",
    relationshipType: "OneN",
    keymapName: "relationshipOneN",
  },
  {
    name: "One",
    relationshipType: "One",
    keymapName: "relationshipOne",
  },
  {
    name: "N",
    relationshipType: "N",
    keymapName: "relationshipN",
  },
];
function createRelationshipMenus(store: Store, keymap: Keymap): Menu[] {
  return relationshipMenus.map((relationshipMenu) => {
    return {
      icon: getBase64Icon(relationshipMenu.relationshipType),
      base64: true,
      name: relationshipMenu.name,
      keymap: keymapOptionToString(keymap[relationshipMenu.keymapName][0]),
      execute() {
        store.dispatch(
          drawStartRelationship(relationshipMenu.relationshipType)
        );
      },
    };
  });
}

export function createContextmenuRelationship(
  store: Store,
  relationship: Relationship
): Menu[] {
  return [
    {
      name: "RelationshipType",
      children: createRelationshipSingleMenus(store, relationship),
    },
    {
      name: "Delete",
      execute() {
        store.dispatch(removeRelationship([relationship.id]));
      },
    },
  ];
}

function createRelationshipSingleMenus(
  store: Store,
  relationship: Relationship
): Menu[] {
  return relationshipMenus.map((relationshipMenu) => {
    return {
      icon:
        relationship.relationshipType === relationshipMenu.relationshipType
          ? "check"
          : undefined,
      name: relationshipMenu.name,
      execute() {
        store.dispatch(
          changeRelationshipType(
            relationship.id,
            relationshipMenu.relationshipType
          )
        );
      },
      option: {
        close: false,
        relationshipType: relationshipMenu.relationshipType,
      },
    };
  });
}

export function createContextmenuGeneratorCode(store: Store): Menu[] {
  return [
    {
      icon: "code",
      name: "Language",
      children: createLanguageMenus(store),
    },
    {
      name: "Table Name Case",
      children: createTableCaseMenus(store),
    },
    {
      name: "Column Name Case",
      children: createColumnCaseMenus(store),
    },
  ];
}

const languageKeys: Language[] = [
  "GraphQL",
  "JPA",
  "Java",
  "Kotlin",
  "TypeScript",
  "C#",
];
function createLanguageMenus(store: Store): Menu[] {
  const { canvasState } = store;
  return languageKeys.map((languageKey) => {
    return {
      icon: canvasState.language === languageKey ? "check" : undefined,
      name: languageKey,
      execute() {
        store.dispatch(changeLanguage(languageKey));
      },
      option: {
        close: false,
        language: languageKey,
      },
    };
  });
}

interface NameCaseMenu {
  name: string;
  nameCase: NameCase;
}
const nameCaseMenus: NameCaseMenu[] = [
  {
    name: "Pascal",
    nameCase: "pascalCase",
  },
  {
    name: "Camel",
    nameCase: "camelCase",
  },
  {
    name: "Snake",
    nameCase: "snakeCase",
  },
  {
    name: "None",
    nameCase: "none",
  },
];
function createTableCaseMenus(store: Store): Menu[] {
  const { canvasState } = store;
  return nameCaseMenus.map((nameCaseMenu) => {
    return {
      icon:
        canvasState.tableCase === nameCaseMenu.nameCase ? "check" : undefined,
      name: nameCaseMenu.name,
      execute() {
        store.dispatch(changeTableCase(nameCaseMenu.nameCase));
      },
      option: {
        close: false,
        tableCase: nameCaseMenu.nameCase,
      },
    };
  });
}
function createColumnCaseMenus(store: Store): Menu[] {
  const { canvasState } = store;
  return nameCaseMenus.map((nameCaseMenu) => {
    return {
      icon:
        canvasState.columnCase === nameCaseMenu.nameCase ? "check" : undefined,
      name: nameCaseMenu.name,
      execute() {
        store.dispatch(changeColumnCase(nameCaseMenu.nameCase));
      },
      option: {
        close: false,
        columnCase: nameCaseMenu.nameCase,
      },
    };
  });
}
