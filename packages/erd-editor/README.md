# erd-editor

> Entity-Relationship Diagram Editor

![erd-editor](https://github.com/dineug/erd-editor/blob/main/img/erd-editor-vscode.png?raw=true)

# Install

```sh
npm install @dineug/erd-editor
```

## Usage

```js
import '@dineug/erd-editor';

const editor = document.createElement('erd-editor');
document.body.appendChild(editor);
```

### CDN

```html
<script type="module">
  import 'https://esm.run/@dineug/erd-editor';

  const editor = document.createElement('erd-editor');
  document.body.appendChild(editor);
</script>
<!-- or -->
<script type="module" src="https://esm.run/@dineug/erd-editor"></script>
```

### html

```html
<erd-editor readonly system-dark-mode enable-theme-builder></erd-editor>
<script type="module">
  import 'https://esm.run/@dineug/erd-editor';

  const editor = document.querySelector('erd-editor');
</script>
```

# ErdEditorElement

```ts
interface ErdEditorElement extends HTMLElement {
  readonly: boolean;
  systemDarkMode: boolean; // system dark/light auto
  enableThemeBuilder: boolean;
  value: string;
  focus: () => void;
  blur: () => void;
  clear: () => void;
  destroy: () => void;
  setInitialValue: (value: string) => void;
  setPresetTheme: (themeOptions: Partial<ThemeOptions>) => void;
  setTheme: (theme: Partial<Theme>) => void;
  setKeyBindingMap: (keyBindingMap: Partial<KeyBindingMap>) => void;
  setSchemaSQL: (value: string) => void;
  getSchemaSQL: (databaseVendor?: DatabaseVendor) => string;
  getSharedStore: (config?: SharedStoreConfig) => SharedStore;
}
```

## readonly

Sets the editing capability of the editor.

```js
editor.readonly = true;
// or
editor.setAttribute('readonly', 'true');
```

```html
<erd-editor readonly></erd-editor>
```

## systemDarkMode

Determines whether to automatically synchronize with the system's dark/light mode.

```js
editor.systemDarkMode = true;
// or
editor.setAttribute('systemDarkMode', 'true');
```

```html
<erd-editor system-dark-mode></erd-editor>
```

## enableThemeBuilder

Determines if a UI for easily setting preset themes is provided.

<img src="https://github.com/dineug/erd-editor/blob/main/img/theme-builder.png?raw=true" width="400" />

```js
editor.enableThemeBuilder = true;
// or
editor.setAttribute('enableThemeBuilder', 'true');
```

```html
<erd-editor enable-theme-builder></erd-editor>
```

Triggers the `changePresetTheme` event upon changing the preset theme.

```js
editor.addEventListener('changePresetTheme', event => {
  const themeOptions = event.detail;
});
```

## value

### getter

Retrieves the current editor state as JSON data.

```js
const data = editor.value;
```

### setter

Loads a previously saved editor state. It is recorded in the history list, enabling `Undo, Redo`.

```js
editor.value = 'json...';
```

## setInitialValue

Loads a previously saved editor state. It is not recorded in the history list, so `Undo, Redo` is not possible.

```js
editor.setInitialValue('json...');
```

## Event

### change

When there are changes in the editor, it emits an event.

```js
editor.addEventListener('change', event => {
  const data = event.target.value;
});
```

## focus

Focuses on the editor.

```js
editor.focus();
```

## blur

Removes focus from the editor.

```js
editor.blur();
```

## clear

Resets the editor state.

```js
editor.clear();
```

## destroy

Completely disables reusing the editor instance.

```js
editor.destroy();
```

## setKeyBindingMap

Redefines keyboard shortcuts.

```ts
type ShortcutOption = {
  shortcut: string;
  preventDefault?: boolean;
  stopPropagation?: boolean;
};

const defaultKeyBindingMap: KeyBindingMap = {
  addTable: [{ shortcut: 'Alt+KeyN' }];
  addColumn: [{ shortcut: 'Alt+Enter' }];
  addMemo: [{ shortcut: 'Alt+KeyM' }];
  removeTable: [{ shortcut: '$mod+Backspace' }, { shortcut: '$mod+Delete' }];
  removeColumn: [{ shortcut: 'Alt+Backspace' }, { shortcut: 'Alt+Delete' }];
  primaryKey: [{ shortcut: 'Alt+KeyK' }];
  selectAllTable: [{ shortcut: '$mod+Alt+KeyA' }];
  selectAllColumn: [{ shortcut: 'Alt+KeyA' }];
  relationshipZeroOne: [{ shortcut: '$mod+Alt+Digit1' }];
  relationshipZeroN: [{ shortcut: '$mod+Alt+Digit2' }];
  relationshipOneOnly: [{ shortcut: '$mod+Alt+Digit3' }];
  relationshipOneN: [{ shortcut: '$mod+Alt+Digit4' }];
  tableProperties: [{ shortcut: 'Alt+Space' }];
};

// example
editor.setKeyBindingMap({
  addTable: [{ shortcut: '$mod+KeyN', preventDefault: true }];
});
```

### $mod

Switches `Control` key depending on the environment.

- Mac: $mod = Meta (⌘)
- Windows/Linux: $mod = Control

### Shortcut Table

Uses keyboard event `key, code` properties.  
Use `code` for absolute positions and `key` for input values.

| Windows       | macOS           | `key`         | `code`                         |
| ------------- | --------------- | ------------- | ------------------------------ |
| N/A           | `Command` / `⌘` | `Meta`        | `MetaLeft` / `MetaRight`       |
| `Alt`         | `Option` / `⌥`  | `Alt`         | `AltLeft` / `AltRight`         |
| `Control`     | `Control` / `^` | `Control`     | `ControlLeft` / `ControlRight` |
| `Shift`       | `Shift`         | `Shift`       | `ShiftLeft` / `ShiftRight`     |
| `Space`       | `Space`         | N/A           | `Space`                        |
| `Enter`       | `Return`        | `Enter`       | `Enter`                        |
| `Esc`         | `Esc`           | `Escape`      | `Escape`                       |
| `1`, `2`, etc | `1`, `2`, etc   | `1`, `2`, etc | `Digit1`, `Digit2`, etc        |
| `a`, `b`, etc | `a`, `b`, etc   | `a`, `b`, etc | `KeyA`, `KeyB`, etc            |
| `-`           | `-`             | `-`           | `Minus`                        |
| `=`           | `=`             | `=`           | `Equal`                        |
| `+`           | `+`             | `+`           | `Equal`\*                      |

## Theme

### setPresetTheme

Sets a preset theme.

```ts
type ThemeOptions = {
  appearance: 'dark' | 'light';
  grayColor: 'gray' | 'mauve' | 'slate' | 'sage' | 'olive' | 'sand';
  accentColor:
    | 'gray'
    | 'gold'
    | 'bronze'
    | 'brown'
    | 'yellow'
    | 'amber'
    | 'orange'
    | 'tomato'
    | 'red'
    | 'ruby'
    | 'crimson'
    | 'pink'
    | 'plum'
    | 'purple'
    | 'violet'
    | 'iris'
    | 'indigo'
    | 'blue'
    | 'cyan'
    | 'teal'
    | 'jade'
    | 'green'
    | 'grass'
    | 'lime'
    | 'mint'
    | 'sky';
};

// example
editor.setPresetTheme({ appearance: 'light' });
```

### setTheme

Allows customizing the theme.

#### JavaScript

```ts
type Theme = {
  grayColor1: string;
  grayColor2: string;
  grayColor3: string;
  grayColor4: string;
  grayColor5: string;
  grayColor6: string;
  grayColor7: string;
  grayColor8: string;
  grayColor9: string;
  grayColor10: string;
  grayColor11: string;
  grayColor12: string;

  accentColor1: string;
  accentColor2: string;
  accentColor3: string;
  accentColor4: string;
  accentColor5: string;
  accentColor6: string;
  accentColor7: string;
  accentColor8: string;
  accentColor9: string;
  accentColor10: string;
  accentColor11: string;
  accentColor12: string;

  canvasBackground: string;
  canvasBoundaryBackground: string;

  tableBackground: string;
  tableSelect: string;
  tableBorder: string;

  memoBackground: string;
  memoSelect: string;
  memoBorder: string;

  columnSelect: string;
  columnHover: string;

  relationshipHover: string;

  toolbarBackground: string;

  contextMenuBackground: string;
  contextMenuSelect: string;
  contextMenuHover: string;
  contextMenuBorder: string;

  minimapBorder: string;
  minimapShadow: string;
  minimapViewportBorder: string;
  minimapViewportBorderHover: string;

  toastBackground: string;
  toastBorder: string;

  dargSelectBackground: string;
  dargSelectBorder: string;

  scrollbarTrack: string;
  scrollbarThumb: string;
  scrollbarThumbHover: string;

  foreground: string;
  active: string;
  placeholder: string;

  focus: string;
  inputActive: string;

  keyPK: string;
  keyFK: string;
  keyPFK: string;
};


// example
editor.setTheme({...});
```

#### CSS Variables

```css
:root {
  --erd-editor-gray-color-1: #111113;
  --erd-editor-gray-color-2: #18191b;
  --erd-editor-gray-color-3: #212225;
  --erd-editor-gray-color-4: #272a2d;
  --erd-editor-gray-color-5: #2e3135;
  --erd-editor-gray-color-6: #363a3f;
  --erd-editor-gray-color-7: #43484e;
  --erd-editor-gray-color-8: #5a6169;
  --erd-editor-gray-color-9: #696e77;
  --erd-editor-gray-color-10: #777b84;
  --erd-editor-gray-color-11: #b0b4ba;
  --erd-editor-gray-color-12: #edeef0;
  --erd-editor-accent-color-1: #11131f;
  --erd-editor-accent-color-2: #141726;
  --erd-editor-accent-color-3: #182449;
  --erd-editor-accent-color-4: #1d2e62;
  --erd-editor-accent-color-5: #253974;
  --erd-editor-accent-color-6: #304384;
  --erd-editor-accent-color-7: #3a4f97;
  --erd-editor-accent-color-8: #435db1;
  --erd-editor-accent-color-9: #3e63dd;
  --erd-editor-accent-color-10: #5472e4;
  --erd-editor-accent-color-11: #9eb1ff;
  --erd-editor-accent-color-12: #d6e1ff;
  --erd-editor-canvas-background: #212225;
  --erd-editor-canvas-boundary-background: #111113;
  --erd-editor-table-background: #18191b;
  --erd-editor-table-select: #435db1;
  --erd-editor-table-border: #363a3f;
  --erd-editor-memo-background: #18191b;
  --erd-editor-memo-select: #435db1;
  --erd-editor-memo-border: #363a3f;
  --erd-editor-column-select: #2e3135;
  --erd-editor-column-hover: #272a2d;
  --erd-editor-relationship-hover: #435db1;
  --erd-editor-toolbar-background: #111113;
  --erd-editor-context-menu-background: #18191b;
  --erd-editor-context-menu-select: #272a2d;
  --erd-editor-context-menu-hover: #3a4f97;
  --erd-editor-context-menu-border: #363a3f;
  --erd-editor-minimap-border: black;
  --erd-editor-minimap-shadow: black;
  --erd-editor-minimap-viewport-border: #3a4f97;
  --erd-editor-minimap-viewport-border-hover: #435db1;
  --erd-editor-toast-background: #18191b;
  --erd-editor-toast-border: #363a3f;
  --erd-editor-darg-select-background: #253974;
  --erd-editor-darg-select-border: #435db1;
  --erd-editor-scrollbar-track: #ddeaf814;
  --erd-editor-scrollbar-thumb: #696e77;
  --erd-editor-scrollbar-thumb-hover: #777b84;
  --erd-editor-foreground: #b0b4ba;
  --erd-editor-active: #edeef0;
  --erd-editor-placeholder: #e5edfd7b;
  --erd-editor-focus: #435db1;
  --erd-editor-input-active: #5472e4;
  --erd-editor-key-pk: #ffc53d;
  --erd-editor-key-fk: #e54666;
  --erd-editor-key-pfk: #00a2c7;
}
```

## setSchemaSQL

Loads a schema SQL file.

```js
editor.setSchemaSQL('Schema SQL...');
```

## getSchemaSQL

Extracts the current editor state into a schema SQL.  
If `databaseVendor` is not specified, it operates based on the currently set vendor.

```ts
type DatabaseVendor =
  | 'MariaDB'
  | 'MSSQL'
  | 'MySQL'
  | 'Oracle'
  | 'PostgreSQL'
  | 'SQLite';

const schemaSQL = editor.getSchemaSQL();
```

# Document

- [Web App](https://erd-editor.io)
- [VSCode Extension](https://marketplace.visualstudio.com/items?itemName=dineug.vuerd-vscode)
- [Editing Guide](https://docs.erd-editor.io/docs/category/guides)
- [API](https://docs.erd-editor.io/docs/api/erd-editor-element)
