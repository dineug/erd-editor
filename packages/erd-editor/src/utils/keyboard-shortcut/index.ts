import { ValuesType } from '@/internal-types';
import { hasAppleDevice } from '@/utils/device-detect';

import { KeyBindingPress, parseKeybinding } from './utils';

export type ShortcutOption = {
  shortcut: string;
  preventDefault?: boolean;
  stopPropagation?: boolean;
};

export const KeyBindingName = {
  edit: 'edit',
  stop: 'stop',
  search: 'search',
  undo: 'undo',
  redo: 'redo',
  addTable: 'addTable',
  addColumn: 'addColumn',
  addMemo: 'addMemo',
  removeTable: 'removeTable',
  removeColumn: 'removeColumn',
  primaryKey: 'primaryKey',
  selectAllTable: 'selectAllTable',
  selectAllColumn: 'selectAllColumn',
  relationshipZeroOne: 'relationshipZeroOne',
  relationshipZeroN: 'relationshipZeroN',
  relationshipOneOnly: 'relationshipOneOnly',
  relationshipOneN: 'relationshipOneN',
  tableProperties: 'tableProperties',
  zoomIn: 'zoomIn',
  zoomOut: 'zoomOut',
} as const;
export type KeyBindingName = ValuesType<typeof KeyBindingName>;
export const KeyBindingNameList = Object.values(KeyBindingName);

export type KeyBindingMap = Record<KeyBindingName, ShortcutOption[]>;

export const createKeyBindingMap = (): KeyBindingMap => ({
  [KeyBindingName.edit]: [{ shortcut: 'Enter' }],
  [KeyBindingName.stop]: [{ shortcut: 'Escape' }],
  [KeyBindingName.search]: [
    { shortcut: '$mod+KeyK', preventDefault: true, stopPropagation: true },
  ],
  [KeyBindingName.undo]: [
    { shortcut: '$mod+KeyZ', preventDefault: true, stopPropagation: true },
  ],
  [KeyBindingName.redo]: [
    {
      shortcut: '$mod+Shift+KeyZ',
      preventDefault: true,
      stopPropagation: true,
    },
  ],
  [KeyBindingName.addTable]: [{ shortcut: 'Alt+KeyN', preventDefault: true }],
  [KeyBindingName.addColumn]: [{ shortcut: 'Alt+Enter', preventDefault: true }],
  [KeyBindingName.addMemo]: [{ shortcut: 'Alt+KeyM', preventDefault: true }],
  [KeyBindingName.removeTable]: [
    { shortcut: '$mod+Backspace', preventDefault: true },
    { shortcut: '$mod+Delete', preventDefault: true },
  ],
  [KeyBindingName.removeColumn]: [
    { shortcut: 'Alt+Backspace', preventDefault: true },
    { shortcut: 'Alt+Delete', preventDefault: true },
  ],
  [KeyBindingName.primaryKey]: [{ shortcut: 'Alt+KeyK', preventDefault: true }],
  [KeyBindingName.selectAllTable]: [
    { shortcut: '$mod+Alt+KeyA', preventDefault: true },
  ],
  [KeyBindingName.selectAllColumn]: [
    { shortcut: 'Alt+KeyA', preventDefault: true },
  ],
  [KeyBindingName.relationshipZeroOne]: [
    { shortcut: '$mod+Alt+Digit1', preventDefault: true },
  ],
  [KeyBindingName.relationshipZeroN]: [
    { shortcut: '$mod+Alt+Digit2', preventDefault: true },
  ],
  [KeyBindingName.relationshipOneOnly]: [
    { shortcut: '$mod+Alt+Digit3', preventDefault: true },
  ],
  [KeyBindingName.relationshipOneN]: [
    { shortcut: '$mod+Alt+Digit4', preventDefault: true },
  ],
  [KeyBindingName.tableProperties]: [
    { shortcut: 'Alt+Space', preventDefault: true },
  ],
  [KeyBindingName.zoomIn]: [
    { shortcut: '$mod+Equal', preventDefault: true, stopPropagation: true },
  ],
  [KeyBindingName.zoomOut]: [
    { shortcut: '$mod+Minus', preventDefault: true, stopPropagation: true },
  ],
});

const ModifierKey = {
  Shift: 'Shift',
  Meta: 'Meta',
  Alt: 'Alt',
  Control: 'Control',
} as const;
type ModifierKey = ValuesType<typeof ModifierKey>;

const MacModifierKeyMap: Record<ModifierKey, string> = {
  [ModifierKey.Shift]: '⇧', // Shift
  [ModifierKey.Meta]: '⌘', // Cmd
  [ModifierKey.Alt]: '⌥', // Option
  [ModifierKey.Control]: '⌃', // Ctrl
};

const WindowsModifierKeyMap: Record<ModifierKey, string> = {
  [ModifierKey.Shift]: 'Shift',
  [ModifierKey.Meta]: 'Cmd',
  [ModifierKey.Alt]: 'Alt',
  [ModifierKey.Control]: 'Ctrl',
};

function modifierKeyToString(key: string) {
  const modifierKeyMap = hasAppleDevice()
    ? MacModifierKeyMap
    : WindowsModifierKeyMap;
  return modifierKeyMap[key as ModifierKey] ?? key;
}

function codeToString(code: string) {
  if (code.startsWith('Key')) {
    return code.slice(3);
  }

  if (code.startsWith('Digit')) {
    return code.slice(5);
  }

  if (code === 'Backspace') {
    return '⌫';
  }

  if (code === 'Escape') {
    return 'ESC';
  }

  if (code === 'Equal') {
    return 'Plus';
  }

  return code;
}

export function shortcutToTuple(shortcut?: string): KeyBindingPress[] {
  return shortcut
    ? parseKeybinding(shortcut).map(([mods, key]) => [
        mods.map(modifierKeyToString),
        codeToString(key),
      ])
    : [];
}

export function isMod(event: MouseEvent | TouchEvent | KeyboardEvent): boolean {
  return hasAppleDevice() ? event.metaKey : event.ctrlKey;
}

export function simpleShortcutToString(shortcut?: string): string {
  return shortcutToTuple(shortcut)
    .map(([mods, key]) => [...mods, key].join(' + '))
    .join(' ');
}
