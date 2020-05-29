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
}

export interface Theme {
  canvas?: string;
  table?: string;
  tableActive?: string;
  focus?: string;
  keyPK?: string;
  keyFK?: string;
  keyPFK?: string;
  relationshipActive?: string;
  font?: string;
  fontActive?: string;
  fontPlaceholder?: string;
  contextmenu?: string;
  contextmenuActive?: string;
  edit?: string;
  mark?: string;
  columnSelect?: string;
  columnActive?: string;
  minimapShadow?: string;
  minimapHandle?: string;
  scrollBarThumb?: string;
  scrollBarThumbActive?: string;
  dragSelect?: string;
  menubar?: string;
  visualization?: string;
  help?: string;
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
