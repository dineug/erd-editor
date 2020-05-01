# vuerd

> ERD Editor

[![npm version](https://img.shields.io/npm/v/vuerd.svg?color=blue)](https://www.npmjs.com/package/vuerd) [![VS Marketplace version](https://vsmarketplacebadge.apphb.com/version-short/dineug.vuerd-vscode.svg?color=blue)](https://marketplace.visualstudio.com/items?itemName=dineug.vuerd-vscode) [![GitHub](https://img.shields.io/github/license/vuerd/vuerd)](https://github.com/vuerd/vuerd/blob/master/LICENSE)

## ERD

![vuerd](https://github.com/vuerd/vuerd/blob/master/img/vuerd-erd.gif?raw=true)

## SQL DDL

![vuerd](https://github.com/vuerd/vuerd/blob/master/img/vuerd-ddl.gif?raw=true)

## Generator Code

![vuerd](https://github.com/vuerd/vuerd/blob/master/img/vuerd-generator-code.gif?raw=true)

## Visualization

![vuerd](https://github.com/vuerd/vuerd/blob/master/img/vuerd-visualization.gif?raw=true)

## SQL DDL Import

![vuerd](https://github.com/vuerd/vuerd/blob/master/img/vuerd-ddl-import.gif?raw=true)

## Document

- [Live Demo](https://vuerd.github.io/vuerd/)
- [vscode extension](https://marketplace.visualstudio.com/items?itemName=dineug.vuerd-vscode)

## Dependency

- [ES6](https://developer.mozilla.org/ko/docs/Web/JavaScript/New_in_JavaScript/ECMAScript_6_support_in_Mozilla)
- [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) - Observable
- [custom elements](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements) - Web Standard Interface
- [shadow DOM](https://developer.mozilla.org/ko/docs/Web/Web_Components/Using_shadow_DOM) - CSS encapsulation
- [Node.getRootNode()](https://developer.mozilla.org/en-US/docs/Web/API/Node/getRootNode) - Instance EditorContext Injection
- [CSS variables](https://developer.mozilla.org/en-US/docs/Web/CSS/--*) - Custom Theme

## interface EditorElement

```typescript
interface Editor extends HTMLElement {
  context: EditorContext;
  width: number;
  height: number;
  value: string;
  focus(): void;
  blur(): void;
  clear(): void;
  setTheme(theme: Theme): void;
  setKeymap(keymap: Keymap): void;
}
```

| Name      | Type     | Describe           |
| --------- | -------- | ------------------ |
| width     | Number   | width              |
| height    | Number   | height             |
| value     | String   | editor data        |
| change    | Event    | editor data        |
| focus     | Function | keymap on(default) |
| blur      | Function | keymap off         |
| clear     | Function | editor data clear  |
| setTheme  | Function | custom theme       |
| setKeymap | Function | custom keymap      |

### EditorElement Example

```javascript
const container = document.querySelector("#app");
const editor = document.createElement("erd-editor");
container.appendChild(editor);
editor.addEventListener("change", (event) => {
  console.log(event.detail.value);
});
window.addEventListener("resize", () => {
  editor.width = window.innerWidth;
  editor.height = window.innerHeight;
});
window.dispatchEvent(new Event("resize"));
```

## interface Custom Theme

```typescript
interface Theme {
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
```

### Custom Theme Example

### css

```css
:root {
  --vuerd-theme-canvas: #282828;
  --vuerd-theme-table: #191919;
  --vuerd-theme-table-active: #14496d;
  --vuerd-theme-focus: #00a9ff;
  --vuerd-theme-key-pk: #b4b400;
  --vuerd-theme-key-fk: #dda8b1;
  --vuerd-theme-key-pfk: #60b9c4;
  --vuerd-theme-relationship-active: #ffc107;
  --vuerd-theme-font: #a2a2a2;
  --vuerd-theme-font-active: white;
  --vuerd-theme-font-placeholder: #6d6d6d;
  --vuerd-theme-contextmenu: #191919;
  --vuerd-theme-contextmenu-active: #383d41;
  --vuerd-theme-edit: #ffc107;
  --vuerd-theme-mark: #ffc107;
  --vuerd-theme-column-select: #232a2f;
  --vuerd-theme-column-active: #372908;
  --vuerd-theme-minimap-shadow: black;
  --vuerd-theme-minimap-handle: #ffc107;
  --vuerd-theme-scrollbar-thumb: #6d6d6d;
  --vuerd-theme-scrollbar-thumb-active: #a2a2a2;
  --vuerd-theme-drag-select: #0098ff;
  --vuerd-theme-menubar: black;
  --vuerd-theme-visualization: #191919;
  --vuerd-theme-help: #191919;
}
```

### javascript

```javascript
const editor = document.createElement("erd-editor");
editor.setTheme({
  canvas: "#282828",
  table: "#191919",
  tableActive: "#14496d",
  focus: "#00a9ff",
  keyPK: "#B4B400",
  keyFK: "#dda8b1",
  keyPFK: "#60b9c4",
  relationshipActive: "#ffc107",
  font: "#a2a2a2",
  fontActive: "white",
  fontPlaceholder: "#6D6D6D",
  contextmenu: "#191919",
  contextmenuActive: "#383d41",
  edit: "#ffc107",
  mark: "#ffc107",
  columnSelect: "#232a2f",
  columnActive: "#372908",
  minimapShadow: "black",
  minimapHandle: "#ffc107",
  scrollBarThumb: "#6D6D6D",
  scrollBarThumbActive: "#a2a2a2",
  dragSelect: "#0098ff",
  menubar: "black",
  visualization: "#191919",
  help: "#191919",
});
```

## interface Custom Keymap

```typescript
interface KeymapOption {
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  key?: Key;
}
interface Keymap {
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
```

### Custom Keymap Example

```javascript
const editor = document.createElement("erd-editor");
editor.setKeymap({
  addTable: [
    {
      metaKey: false,
      ctrlKey: false,
      altKey: true,
      shiftKey: false,
      key: "N",
    },
  ],
  addColumn: [
    {
      metaKey: false,
      ctrlKey: false,
      altKey: true,
      shiftKey: false,
      key: "Enter",
    },
  ],
  addMemo: [], // remove keymap
});
```

## Install

```bash
$ yarn add vuerd
or
$ npm install vuerd
```

## Usage

### javascript

```javascript
import "vuerd";

const container = document.querySelector("#app");
const editor = document.createElement("erd-editor");
container.appendChild(editor);
```

### typescript

```typescript
import { Editor } from "vuerd";

const container = document.querySelector("#app");
const editor = document.createElement("erd-editor") as Editor;
container.appendChild(editor);
```

## CDN Quick Start

```html
<!DOCTYPE html>
<html>
  <head>
    <title>vuerd demo</title>
    <style>
      body {
        margin: 0;
      }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/vuerd/dist/vuerd.min.js"></script>
  </head>
  <body>
    <erd-editor id="editor"></erd-editor>
    <script>
      const editor = document.querySelector("#editor");
      window.addEventListener("resize", () => {
        editor.width = window.innerWidth;
        editor.height = window.innerHeight;
      });
      window.dispatchEvent(new Event("resize"));
    </script>
  </body>
</html>
```

## Editor Keymap(default)

| Name                                                | Action                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------ |
| Editing - ERD                                       | dblclick, Enter                                                          |
| Editing - Grid                                      | dblclick, Enter                                                          |
| All Stop                                            | Escape                                                                   |
| Selection - table, memo                             | Ctrl + Drag, Click, Ctrl + Click, Ctrl + Alt + A                         |
| Selection - column                                  | Click, Ctrl + Click, Shift + Click, Shift + Arrow key(up, down), Alt + A |
| Movement - table, memo, column                      | Drag, Ctrl + Drag                                                        |
| Copy - column                                       | Ctrl + C                                                                 |
| Paste - column                                      | Ctrl + V                                                                 |
| Contextmenu - ERD, Relationship, SQL, GeneratorCode | Right-click                                                              |
| New Table                                           | Alt + N                                                                  |
| New Memo                                            | Alt + M                                                                  |
| New Column                                          | Alt + Enter                                                              |
| Delete - table, memo                                | Ctrl + Delete                                                            |
| Delete - column                                     | Alt + Delete                                                             |
| Select DataType Hint                                | Arrow key(right), Click                                                  |
| Move DataType Hint                                  | Arrow key(up, down)                                                      |
| Primary Key                                         | Alt + K                                                                  |
| Option Checked - Grid                               | Space, Click                                                             |
| Move Option - Grid                                  | Arrow key(up, down, left, right)                                         |
| Relationship - Zero One N                           | Ctrl + Alt + 1                                                           |
| Relationship - Zero One                             | Ctrl + Alt + 2                                                           |
| Relationship - Zero N                               | Ctrl + Alt + 3                                                           |
| Relationship - One Only                             | Ctrl + Alt + 4                                                           |
| Relationship - One N                                | Ctrl + Alt + 5                                                           |
| Relationship - One                                  | Ctrl + Alt + 6                                                           |
| Relationship - N                                    | Ctrl + Alt + 7                                                           |

## TODO

- [ ] Undo, Redo Manager
- [ ] Grid filter
- [ ] ERD Table finder
- [ ] Real-time simultaneous editing api
- [ ] SQL index Support [#9](https://github.com/vuerd/vuerd-vscode/issues/9)
- SQL DDL import Support [#7](https://github.com/vuerd/vuerd-vscode/issues/7)
  - [ ] Oracle
  - [ ] MSSQL
  - [ ] PostgreSQL

## License

[MIT](https://github.com/vuerd/vuerd/blob/master/LICENSE)
