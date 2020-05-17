# vuerd

> ERD Editor

[![npm version](https://img.shields.io/npm/v/vuerd.svg?style=flat-square&color=blue)](https://www.npmjs.com/package/vuerd) [![VS Marketplace version](https://vsmarketplacebadge.apphb.com/version-short/dineug.vuerd-vscode.svg?style=flat-square&color=blue&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=dineug.vuerd-vscode) [![Published on webcomponents.org](https://img.shields.io/badge/webcomponents.org-published-blue.svg?style=flat-square&logo=webcomponents.org)](https://www.webcomponents.org/element/vuerd) [![GitHub](https://img.shields.io/github/license/vuerd/vuerd?style=flat-square&color=blue)](https://github.com/vuerd/vuerd/blob/master/LICENSE)

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

- [Storybook](https://vuerd.github.io/vuerd/)
- [Live Demo](https://vuerd.github.io/vuerd/iframe.html?id=editor--load)
- [vscode extension](https://marketplace.visualstudio.com/items?itemName=dineug.vuerd-vscode)

## Dependency

- [ES6](https://developer.mozilla.org/en-US/docs/Archive/Web/JavaScript/New_in_JavaScript/ECMAScript_2015_support_in_Mozilla)
- [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) - Observable
- [custom elements](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements) - Web Standard Interface
- [shadow DOM](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_shadow_DOM) - CSS encapsulation
- [Node.getRootNode()](https://developer.mozilla.org/en-US/docs/Web/API/Node/getRootNode) - Instance EditorContext Injection
- [CSS variables](https://developer.mozilla.org/en-US/docs/Web/CSS/--*) - Custom Theme

## interface EditorElement

```typescript
interface Editor extends HTMLElement {
  width: number;
  height: number;
  value: string;
  focus(): void;
  blur(): void;
  initLoadJson(json: string): void;
  clear(): void;
  setTheme(theme: Theme): void;
  setKeymap(keymap: Keymap): void;
}
```

| Name         | Type     | Describe                    |
| ------------ | -------- | --------------------------- |
| width        | Number   | width                       |
| height       | Number   | height                      |
| value        | String   | editor data                 |
| change       | Event    | editor data                 |
| focus        | Function | keymap on(default)          |
| blur         | Function | keymap off                  |
| initLoadJson | Function | Do not record and save undo |
| clear        | Function | editor data clear           |
| setTheme     | Function | custom theme                |
| setKeymap    | Function | custom keymap               |

### EditorElement Example

```javascript
const container = document.querySelector("#app");
const editor = document.createElement("erd-editor");
// editor data load
editor.initLoadJson("editor data...");
// or
// editor.value = "editor data...";
container.appendChild(editor);
editor.addEventListener("change", (event) => {
  console.log(event.target.value);
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

| Name | Type                    | Describe                                                                                                                                               |
| ---- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| key  | event.key or event.code | [Key](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key), [Code](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code) |

```typescript
interface KeymapOption {
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  key?: string;
}
interface Keymap {
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
    <!-- or module -->
    <!-- <script type="module" src="https://cdn.jsdelivr.net/npm/vuerd/dist/vuerd.esm.js"></script> -->
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

| Name                                                | Keymap                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------ |
| Editing - ERD                                       | dblclick, Enter                                                          |
| Editing - Grid                                      | dblclick, Enter                                                          |
| All Stop                                            | Escape                                                                   |
| Search - find, filter                               | Ctrl + Alt + F                                                           |
| Undo - ERD                                          | Ctrl + Z                                                                 |
| Redo - ERD                                          | Ctrl + Shift + Z                                                         |
| Selection - table, memo                             | Ctrl + Drag, Click, Ctrl + Click, Ctrl + Alt + A                         |
| Selection - column, filter                          | Click, Ctrl + Click, Shift + Click, Shift + Arrow key(up, down), Alt + A |
| Movement - table, memo, column, filter              | Drag, Ctrl + Drag                                                        |
| Copy - column                                       | Ctrl + C                                                                 |
| Paste - column                                      | Ctrl + V                                                                 |
| Contextmenu - ERD, Relationship, SQL, GeneratorCode | Right-click                                                              |
| New Table                                           | Alt + N                                                                  |
| New Memo                                            | Alt + M                                                                  |
| New - column, filter                                | Alt + Enter                                                              |
| Delete - table, memo                                | Ctrl + Delete                                                            |
| Delete - column, filter                             | Alt + Delete                                                             |
| Select Hint - dataType, find                        | Arrow key(right), Click                                                  |
| Move Hint - dataType, find                          | Arrow key(up, down)                                                      |
| Primary Key                                         | Alt + K                                                                  |
| checkbox - Grid, filter                             | Space, Click                                                             |
| Move checkbox - Grid, filter                        | Arrow key(up, down, left, right)                                         |
| Relationship - Zero One N                           | Ctrl + Alt + 1                                                           |
| Relationship - Zero One                             | Ctrl + Alt + 2                                                           |
| Relationship - Zero N                               | Ctrl + Alt + 3                                                           |
| Relationship - One Only                             | Ctrl + Alt + 4                                                           |
| Relationship - One N                                | Ctrl + Alt + 5                                                           |
| Relationship - One                                  | Ctrl + Alt + 6                                                           |
| Relationship - N                                    | Ctrl + Alt + 7                                                           |

## TODO

- [x] Undo, Redo Manager
- [x] Grid filter
- [x] ERD Table finder
- [ ] Real-time simultaneous editing api
- [ ] SQL index Support [#9](https://github.com/vuerd/vuerd-vscode/issues/9)
- SQL DDL import Support [#7](https://github.com/vuerd/vuerd-vscode/issues/7)
  - [ ] Oracle
  - [ ] MSSQL
  - [ ] PostgreSQL
- [ ] SQL-Query generator [#3](https://github.com/vuerd/vuerd/issues/3)

## License

[MIT](https://github.com/vuerd/vuerd/blob/master/LICENSE)
