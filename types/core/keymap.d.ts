export interface KeymapOption {
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  key?: string;
  preventDefault?: boolean;
  stopPropagation?: boolean;
}

export interface Keymap {
  edit: KeymapOption[];
  stop: KeymapOption[];
  find: KeymapOption[];
  undo: KeymapOption[];
  redo: KeymapOption[];
  addTable: KeymapOption[];
  addColumn: KeymapOption[];
  addMemo: KeymapOption[];
  removeTable: KeymapOption[];
  removeColumn: KeymapOption[];
  primaryKey: KeymapOption[];
  selectAllTable: KeymapOption[];
  selectAllColumn: KeymapOption[];
  copyColumn: KeymapOption[];
  pasteColumn: KeymapOption[];
  // relationshipZeroOneN: KeymapOption[];
  relationshipZeroOne: KeymapOption[];
  relationshipZeroN: KeymapOption[];
  relationshipOneOnly: KeymapOption[];
  relationshipOneN: KeymapOption[];
  // relationshipOne: KeymapOption[];
  // relationshipN: KeymapOption[];
  tableProperties: KeymapOption[];
}

export type KeymapKey = keyof Keymap;

export type MultipleKey = 'altKey' | 'metaKey' | 'ctrlKey' | 'shiftKey';

export type RelationshipKeymapName =
  | 'relationshipZeroOne'
  | 'relationshipZeroN'
  | 'relationshipOne'
  | 'relationshipN'
  | 'relationshipZeroOneN'
  | 'relationshipOneN'
  | 'relationshipOneOnly';
