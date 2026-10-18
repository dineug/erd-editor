import type { NavigationKey, SelectModifiers } from '@/model/selection';

/** The fields of a KeyboardEvent the grid reads; a real keydown event is one. */
export interface KeyInput {
  key: string;
  code?: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  isComposing?: boolean;
  keyCode?: number;
}

/**
 * What a key asks of the grid: move or extend the selection, open the editor on
 * the cell's value, clear the selected cells, or, while the editor is open,
 * commit and then move as the key would, or cancel.
 */
export type KeyAction =
  | { type: 'move'; key: NavigationKey; mods: SelectModifiers }
  | { type: 'edit' }
  | { type: 'clear' }
  | { type: 'commit'; key: 'Enter' | 'Tab'; mods: SelectModifiers }
  | { type: 'cancel' };

/** Where a key lands: which modifier selects, and whether the focus textarea is the open editor. */
export interface KeyOptions {
  apple: boolean;
  editing?: boolean;
}

/**
 * Every key value the grid may consume, in either mode; the A key counts with
 * Ctrl or Cmd alone. A key outside this list always reaches the host.
 */
export const GRID_KEYS: readonly string[] = Object.freeze([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Tab',
  'Enter',
  'F2',
  'Delete',
  'Backspace',
  'Escape',
  'a',
]);

/** macOS or iOS by the platform string a browser names, where Cmd selects and Ctrl is the system's. */
export const isApplePlatform = (platform: string): boolean =>
  /Mac|iPod|iPhone|iPad/.test(platform);

/** The selection modifiers of a key or a pointer event: Shift, and Cmd on Apple or Ctrl elsewhere. */
export const selectionModifiers = (
  event: Pick<KeyInput, 'shiftKey' | 'ctrlKey' | 'metaKey'>,
  apple: boolean
): SelectModifiers => ({
  shift: event.shiftKey,
  ctrl: apple ? event.metaKey : event.ctrlKey,
});

/**
 * The A key, read from the key value on a Latin layout and from the physical
 * key on any other, where Ctrl names a letter of that script instead.
 */
const isKeyA = ({ key, code }: KeyInput) =>
  /^[a-z]$/i.test(key) ? key.toLowerCase() === 'a' : code === 'KeyA';

/** While the editor is open the caret keys are the textarea's, and only these three are the grid's. */
function editingAction(event: KeyInput, primary: boolean): KeyAction | null {
  if (primary) {
    return null;
  }

  switch (event.key) {
    case 'Enter':
    case 'Tab':
      return {
        type: 'commit',
        key: event.key,
        mods: { shift: event.shiftKey, ctrl: false },
      };
    case 'Escape':
      return { type: 'cancel' };
  }

  return null;
}

/**
 * The action a keydown asks for, or null for a key the grid leaves alone, which
 * the caller neither prevents nor stops: Ctrl+Z, Ctrl+S, copy and paste, every
 * printable key the textarea types, Escape while navigating, Alt with anything.
 */
export function keyAction(
  event: KeyInput,
  { apple, editing = false }: KeyOptions
): KeyAction | null {
  if (event.isComposing || event.keyCode === 229) {
    return null;
  }

  const mods = selectionModifiers(event, apple);
  const primary = Boolean(mods.ctrl);
  const other = apple ? event.ctrlKey : event.metaKey;

  if (event.altKey || other) {
    return null;
  }

  if (editing) {
    return editingAction(event, primary);
  }

  const { key } = event;
  const shift = event.shiftKey;

  switch (key) {
    case 'ArrowUp':
    case 'ArrowDown':
    case 'ArrowLeft':
    case 'ArrowRight':
    case 'Home':
    case 'End':
      return { type: 'move', key, mods };
    case 'PageUp':
    case 'PageDown':
    case 'Tab':
      return primary ? null : { type: 'move', key, mods };
    case 'Enter':
      if (primary) {
        return null;
      }

      return shift ? { type: 'move', key, mods } : { type: 'edit' };
    case 'F2':
      return primary || shift ? null : { type: 'edit' };
    case 'Delete':
    case 'Backspace':
      return primary || shift ? null : { type: 'clear' };
  }

  return primary && !shift && isKeyA(event)
    ? { type: 'move', key: 'SelectAll', mods: { shift: false, ctrl: false } }
    : null;
}
