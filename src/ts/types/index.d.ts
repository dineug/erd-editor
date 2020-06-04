export interface ERDEditorElement extends HTMLElement {
  width: number;
  height: number;
  value: string;
  focus(): void;
  blur(): void;
  initLoadJson(json: string): void;
  clear(): void;
  setTheme(theme: Theme): void;
  setKeymap(keymap: Keymap): void;
  setUser(user: User): void;
  sharePull(effect: (commands: Array<Command<CommandType>>) => void): void;
  sharePush(commands: Array<Command<CommandType>>): void;
}

export interface Theme {
  canvas?: string;
  table?: string;
  tableActive?: string;
  focus?: string;
  keyPK?: string;
  keyFK?: string;
  keyPFK?: string;
  font?: string;
  fontActive?: string;
  fontPlaceholder?: string;
  contextmenu?: string;
  contextmenuActive?: string;
  edit?: string;
  columnSelect?: string;
  columnActive?: string;
  minimapShadow?: string;
  scrollBarThumb?: string;
  scrollBarThumbActive?: string;
  menubar?: string;
  visualization?: string;
}

export interface KeymapOption {
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  key?: string;
}

export interface Keymap {
  edit?: KeymapOption[];
  stop?: KeymapOption[];
  find?: KeymapOption[];
  undo?: KeymapOption[];
  redo?: KeymapOption[];
  addTable?: KeymapOption[];
  addColumn?: KeymapOption[];
  addMemo?: KeymapOption[];
  removeTable?: KeymapOption[];
  removeColumn?: KeymapOption[];
  primaryKey?: KeymapOption[];
  selectAllTable?: KeymapOption[];
  selectAllColumn?: KeymapOption[];
  copyColumn?: KeymapOption[];
  pasteColumn?: KeymapOption[];
  relationshipZeroOneN?: KeymapOption[];
  relationshipZeroOne?: KeymapOption[];
  relationshipZeroN?: KeymapOption[];
  relationshipOneOnly?: KeymapOption[];
  relationshipOneN?: KeymapOption[];
  relationshipOne?: KeymapOption[];
  relationshipN?: KeymapOption[];
}

export interface User {
  name: string;
}

export interface Command<K extends CommandType> {
  type: K;
  data: any;
  user?: { id: string; name: string };
}

export type CommandType =
  // table
  | "table.add"
  | "table.addOnly"
  | "table.move"
  | "table.remove"
  | "table.changeName"
  | "table.changeComment"
  | "table.sort"
  // column
  | "column.add"
  | "column.addOnly"
  | "column.addCustom"
  | "column.remove"
  | "column.changeName"
  | "column.changeComment"
  | "column.changeDataType"
  | "column.changeDefault"
  | "column.changeAutoIncrement"
  | "column.changePrimaryKey"
  | "column.changeUnique"
  | "column.changeNotNull"
  | "column.move"
  // relationship
  | "relationship.add"
  | "relationship.remove"
  | "relationship.changeRelationshipType"
  | "relationship.changeIdentification"
  // memo
  | "memo.add"
  | "memo.addOnly"
  | "memo.move"
  | "memo.remove"
  | "memo.changeValue"
  | "memo.resize"
  // canvas
  | "canvas.resize"
  | "canvas.changeShow"
  | "canvas.changeDatabase"
  | "canvas.changeDatabaseName"
  | "canvas.changeRelationshipDataTypeSync"
  // editor
  | "editor.loadJson"
  | "editor.clear"
  // share
  | "share.mouse";
