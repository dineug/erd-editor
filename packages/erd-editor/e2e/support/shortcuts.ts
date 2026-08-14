/**
 * The editor binds shortcuts through `tinykeys`, which matches on
 * `KeyboardEvent.code` and resolves `$mod` to Meta on Apple devices and Control
 * everywhere else (`src/utils/keyboard-shortcut/index.ts`).
 *
 * Playwright's `ControlOrMeta` follows the same rule, so these strings stay
 * correct on a macOS workstation and on a Linux CI runner alike. Keep them in
 * sync with `createKeyBindingMap()`.
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
 * The bare modifier that `$mod` resolves to, for interactions that hold it down
 * across several mouse events (marquee select, multi-select click).
 *
 * The keyboard and mouse paths resolve the modifier from DIFFERENT signals, and
 * `playwright.config.ts` pins `devices['Desktop Chrome']`, which overrides the
 * user agent but not `navigator.platform`. Measured on a macOS runner:
 *
 *   navigator.userAgent  -> "…(Windows NT 10.0; Win64; x64)…"   (from the device)
 *   navigator.platform   -> "MacIntel"                          (the real host)
 *
 * - KEYBOARD: tinykeys resolves `$mod` from `navigator.platform`, so it wants
 *   Meta on macOS and Control elsewhere — exactly what Playwright's
 *   `ControlOrMeta` produces. The `Shortcut` strings above need no branching.
 * - MOUSE: the editor's `isMod()` goes through `hasAppleDevice()`, which parses
 *   the *user agent*. Under the pinned device that reads as Windows on every
 *   runner, so mouse modifiers are always Control. Verified: Meta+click does
 *   not multi-select here, Control+click does.
 *
 * Both hold on a Linux CI runner too, where platform and user agent agree that
 * the modifier is Control.
 */
export const MOD_KEY = 'Control';

/** `streamZoomLevelAction$` steps the zoom by this much per shortcut press. */
export const ZOOM_STEP = 0.04;

/** `handleWheel` steps the zoom by this much per wheel notch. */
export const WHEEL_ZOOM_STEP = 0.03;
