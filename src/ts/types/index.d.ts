import { LitElement } from "lit-element";
import { EditorContext } from "../core/EditorContext";
import { ThemeKey } from "../core/Theme";
import { KeymapKey, KeymapOption } from "../core/Keymap";

export { ThemeKey, KeymapKey };

export declare class Editor extends LitElement {
  context: EditorContext;
  width: number;
  height: number;
  focus(): void;
  blur(): void;
  setTheme(theme: Theme): void;
  setKeymap(keymap: Keymap): void;
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

export interface Keymap {
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
  edit?: KeymapOption[];
  stop?: KeymapOption[];
  relationshipZeroOneN?: KeymapOption[];
  relationshipZeroOne?: KeymapOption[];
  relationshipZeroN?: KeymapOption[];
  relationshipOneOnly?: KeymapOption[];
  relationshipOneN?: KeymapOption[];
  relationshipOne?: KeymapOption[];
  relationshipN?: KeymapOption[];
}
