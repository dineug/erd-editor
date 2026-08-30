/**
 * The editor binds shortcuts through tinykeys, which matches on
 * KeyboardEvent.code and resolves the modifier by platform. Playwright follows
 * the same rule, so these stay correct on a workstation and on a CI runner.
 */
export const Shortcut = {
  edit: 'Enter',
  stop: 'Escape',
  search: 'ControlOrMeta+KeyK',
  undo: 'ControlOrMeta+KeyZ',
  redo: 'ControlOrMeta+Shift+KeyZ',
  addTable: 'Alt+KeyN',
  addColumn: 'Alt+Enter',
  addMemo: 'Alt+KeyM',
  removeTable: 'ControlOrMeta+Backspace',
  removeColumn: 'Alt+Backspace',
  primaryKey: 'Alt+KeyK',
  selectAllTable: 'ControlOrMeta+Alt+KeyA',
  selectAllColumn: 'Alt+KeyA',
  relationshipZeroOne: 'ControlOrMeta+Alt+Digit1',
  relationshipZeroN: 'ControlOrMeta+Alt+Digit2',
  relationshipOneOnly: 'ControlOrMeta+Alt+Digit3',
  relationshipOneN: 'ControlOrMeta+Alt+Digit4',
  tableProperties: 'Alt+Space',
  zoomIn: 'ControlOrMeta+Equal',
  zoomOut: 'ControlOrMeta+Minus',
} as const;

export type Shortcut = (typeof Shortcut)[keyof typeof Shortcut];

/**
 * The bare modifier for interactions that hold it across several mouse events.
 * The keyboard path reads navigator.platform and the mouse path parses the user
 * agent, which the pinned device overrides, so the mouse modifier is Control.
 */
export const MOD_KEY = 'Control';

/** streamZoomLevelAction$ steps the zoom by this much per shortcut press. */
export const ZOOM_STEP = 0.04;

/** handleWheel steps the zoom by this much per wheel notch. */
export const WHEEL_ZOOM_STEP = 0.03;
