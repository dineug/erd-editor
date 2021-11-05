# vuerd

> Entity-Relationship Diagram Editor

[![npm version](https://img.shields.io/npm/v/vuerd.svg?style=flat-square&color=blue)](https://www.npmjs.com/package/vuerd) [![VS Marketplace version](https://vsmarketplacebadge.apphb.com/version-short/dineug.vuerd-vscode.svg?style=flat-square&color=blue&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=dineug.vuerd-vscode) [![APM](https://img.shields.io/apm/v/vuerd-atom?color=blue&style=flat-square&logo=atom)](https://atom.io/packages/vuerd-atom) [![GitHub](https://img.shields.io/github/license/vuerd/vuerd?style=flat-square&color=blue)](https://github.com/vuerd/vuerd/blob/master/LICENSE) [![PRs](https://img.shields.io/badge/PRs-welcome-blue?style=flat-square)](https://github.com/vuerd/vuerd/pulls) [![CI](https://img.shields.io/github/workflow/status/vuerd/vuerd/CI?label=CI&logo=github&style=flat-square)](https://github.com/vuerd/vuerd/actions)

## ERD

![vuerd](https://github.com/vuerd/vuerd/blob/master/img/vuerd-erd.gif?raw=true)

## Document

- [Playground](https://vuerd.github.io)
- [Import SQL DDL support syntax](https://github.com/vuerd/vuerd/blob/master/packages/sql-ddl-parser/src/SQL_DDL_Test_Case.md)
- [vscode extension](https://marketplace.visualstudio.com/items?itemName=dineug.vuerd-vscode)
- [atom extension](https://atom.io/packages/vuerd-atom)

## interface ERDEditorElement

```typescript
interface ERDEditorElement extends HTMLElement {
  width: number;
  height: number;
  value: string;
  automaticLayout: boolean;
  readonly: boolean;
  focus(): void;
  blur(): void;
  initLoadJson(json: string): void;
  loadSQLDDL(sql: string): void;
  clear(): void;
  setTheme(theme: Theme): void;
  setKeymap(keymap: Keymap): void;
  getSQLDDL(database?: Database): string;
  extension(config: Partial<ExtensionConfig>): void;
}
```

| Name            | Type     | Describe                                                   |
| --------------- | -------- | ---------------------------------------------------------- |
| width           | Number   | width                                                      |
| height          | Number   | height                                                     |
| value           | String   | editor data                                                |
| automaticLayout | Boolean  | automatic layout                                           |
| readonly        | Boolean  | readonly                                                   |
| change          | Event    | editor data                                                |
| focus           | Function | focus                                                      |
| blur            | Function | blur                                                       |
| initLoadJson    | Function | Do not record and save undo                                |
| loadSQLDDL      | Function | import SQL DDL                                             |
| clear           | Function | editor data clear                                          |
| setTheme        | Function | custom theme                                               |
| setKeymap       | Function | custom keymap                                              |
| getSQLDDL       | Function | SQL DDL(MariaDB, MSSQL, MySQL, Oracle, PostgreSQL, SQLite) |
| extension       | Function | plugin API(scope instance)                                 |

### EditorElement Example

### javascript

```javascript
const container = document.querySelector('#app');
const editor = document.createElement('erd-editor');
container.appendChild(editor);

// editor data load
editor.initLoadJson('editor data...');
// or
// editor.value = "editor data...";

editor.addEventListener('change', event => {
  console.log(event.target.value);
});

// layout
window.addEventListener('resize', () => {
  editor.width = window.innerWidth;
  editor.height = window.innerHeight;
});
window.dispatchEvent(new Event('resize'));
// or
// editor.automaticLayout = true;
```

### html

```html
<erd-editor width="800" height="800"></erd-editor>
<!-- or -->
<!-- <erd-editor automatic-layout></erd-editor> -->
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
  font?: string;
  fontActive?: string;
  fontPlaceholder?: string;
  contextmenu?: string;
  contextmenuActive?: string;
  edit?: string;
  columnSelect?: string;
  columnActive?: string;
  minimapShadow?: string;
  scrollbarThumb?: string;
  scrollbarThumbActive?: string;
  menubar?: string;
  visualization?: string;
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
  --vuerd-theme-font: #a2a2a2;
  --vuerd-theme-font-active: white;
  --vuerd-theme-font-placeholder: #6d6d6d;
  --vuerd-theme-contextmenu: #191919;
  --vuerd-theme-contextmenu-active: #383d41;
  --vuerd-theme-edit: #ffc107;
  --vuerd-theme-column-select: #232a2f;
  --vuerd-theme-column-active: #372908;
  --vuerd-theme-minimap-shadow: black;
  --vuerd-theme-scrollbar-thumb: #6d6d6d;
  --vuerd-theme-scrollbar-thumb-active: #a2a2a2;
  --vuerd-theme-menubar: black;
  --vuerd-theme-visualization: #191919;
}
```

### javascript

```javascript
const editor = document.createElement('erd-editor');
editor.setTheme({
  canvas: '#282828',
  table: '#191919',
  tableActive: '#14496d',
  focus: '#00a9ff',
  keyPK: '#B4B400',
  keyFK: '#dda8b1',
  keyPFK: '#60b9c4',
  font: '#a2a2a2',
  fontActive: 'white',
  fontPlaceholder: '#6D6D6D',
  contextmenu: '#191919',
  contextmenuActive: '#383d41',
  edit: '#ffc107',
  columnSelect: '#232a2f',
  columnActive: '#372908',
  minimapShadow: 'black',
  scrollbarThumb: '#6D6D6D',
  scrollbarThumbActive: '#a2a2a2',
  menubar: 'black',
  visualization: '#191919',
});
```

## interface Custom Keymap

| Name | Type                    | Describe                                                                                                                                               |
| ---- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| key  | event.key or event.code | [Key](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key), [Code](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code) |

```typescript
interface KeymapOption {
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  key?: string;
  preventDefault?: boolean;
  stopPropagation?: boolean;
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
  relationshipZeroOne?: KeymapOption[];
  relationshipZeroN?: KeymapOption[];
  relationshipOneOnly?: KeymapOption[];
  relationshipOneN?: KeymapOption[];
  tableProperties?: KeymapOption[];
  zoomIn?: KeymapOption[];
  zoomOut?: KeymapOption[];
}
```

### Custom Keymap Example

```javascript
const editor = document.createElement('erd-editor');
editor.setKeymap({
  addTable: [
    {
      altKey: true,
      key: 'N',
    },
  ],
  addColumn: [
    {
      altKey: true,
      key: 'Enter',
    },
  ],
  addMemo: [], // remove keymap
});
```

## Global API

```typescript
function addIcon(...newIcons: IconDefinition[]): void;
function extension(config: Partial<ExtensionConfig>): void;
```

## Install

```bash
$ yarn add vuerd
or
$ npm install vuerd
```

## Usage

```javascript
import 'vuerd';
// import "vuerd/theme/abyss.css";
// import "vuerd/theme/kimbie-dark.css";
// import "vuerd/theme/monokai.css";
// import "vuerd/theme/monokai-dimmed.css";
// import "vuerd/theme/one-dark-pro.css";
// import "vuerd/theme/red.css";
// import "vuerd/theme/solarized-dark.css";
// import "vuerd/theme/solarized-light.css";
// import "vuerd/theme/tomorrow-night-blue.css";
// import "vuerd/theme/vscode-dark.css";

const container = document.querySelector('#app');
const editor = document.createElement('erd-editor');
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
        height: 100vh;
      }
    </style>
    <!-- <link href="https://cdn.jsdelivr.net/npm/vuerd/theme/abyss.css" rel="stylesheet" /> -->
    <!-- <link href="https://cdn.jsdelivr.net/npm/vuerd/theme/kimbie-dark.css" rel="stylesheet" /> -->
    <!-- <link href="https://cdn.jsdelivr.net/npm/vuerd/theme/monokai.css" rel="stylesheet" /> -->
    <!-- <link href="https://cdn.jsdelivr.net/npm/vuerd/theme/monokai-dimmed.css" rel="stylesheet" /> -->
    <!-- <link href="https://cdn.jsdelivr.net/npm/vuerd/theme/one-dark-pro.css" rel="stylesheet" /> -->
    <!-- <link href="https://cdn.jsdelivr.net/npm/vuerd/theme/red.css" rel="stylesheet" /> -->
    <!-- <link href="https://cdn.jsdelivr.net/npm/vuerd/theme/solarized-dark.css" rel="stylesheet" /> -->
    <!-- <link href="https://cdn.jsdelivr.net/npm/vuerd/theme/solarized-light.css" rel="stylesheet" /> -->
    <!-- <link href="https://cdn.jsdelivr.net/npm/vuerd/theme/tomorrow-night-blue.css" rel="stylesheet" /> -->
    <!-- <link href="https://cdn.jsdelivr.net/npm/vuerd/theme/vscode-dark.css" rel="stylesheet" /> -->
  </head>
  <body>
    <erd-editor></erd-editor>
    <script src="https://cdn.jsdelivr.net/npm/vuerd/dist/vuerd.min.js"></script>
    <!-- or module -->
    <!-- <script type="module" src="https://cdn.jsdelivr.net/npm/vuerd/dist/vuerd.esm.js"></script> -->
    <script>
      const editor = document.querySelector('erd-editor');
      window.addEventListener('resize', () => {
        editor.width = window.innerWidth;
        editor.height = window.innerHeight;
      });
      window.dispatchEvent(new Event('resize'));
    </script>
  </body>
</html>
```

## Editor Keymap(default)

| Name                                                       | Keymap                                                                                   |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Editing - ERD                                              | dblclick, Enter                                                                          |
| Editing - Grid                                             | dblclick, Enter                                                                          |
| All Stop                                                   | Escape                                                                                   |
| Search - find, filter                                      | Ctrl + F, Cmd + F                                                                        |
| Undo - ERD                                                 | Ctrl + Z, Cmd + Z                                                                        |
| Redo - ERD                                                 | Ctrl + Shift + Z, Cmd + Shift + Z                                                        |
| Selection - table, memo                                    | Ctrl + Drag, Click, Ctrl + Click, Ctrl + Alt + A, Cmd + Drag, Cmd + Click, Cmd + Alt + A |
| Selection - column, filter                                 | Click, Ctrl + Click, Cmd + Click, Shift + Click, Shift + Arrow key(up, down), Alt + A    |
| Movement - table, memo, column, filter                     | Drag, Ctrl + Drag, Cmd + Drag                                                            |
| Copy - column                                              | Ctrl + C, Cmd + C                                                                        |
| Paste - column                                             | Ctrl + V, Cmd + V                                                                        |
| Contextmenu - ERD, Table, Relationship, SQL, GeneratorCode | Right-click                                                                              |
| Table Properties                                           | Ctrl + Space, Alt + Space                                                                |
| New Table                                                  | Alt + N                                                                                  |
| New Memo                                                   | Alt + M                                                                                  |
| New - column, filter                                       | Alt + Enter                                                                              |
| Delete - table, memo                                       | Ctrl + Delete, Ctrl + Backspace, Cmd + Delete, Cmd + Backspace                           |
| Delete - column, filter                                    | Alt + Delete, Alt + Backspace                                                            |
| Select Hint - dataType, find                               | Arrow key(right), Click                                                                  |
| Move Hint - dataType, find                                 | Arrow key(up, down)                                                                      |
| Primary Key                                                | Alt + K                                                                                  |
| checkbox - Grid, filter                                    | Space, Click                                                                             |
| Move checkbox - Grid, filter                               | Arrow key(up, down, left, right)                                                         |
| Relationship - Zero One                                    | Ctrl + Alt + 1, Cmd + Alt + 1                                                            |
| Relationship - Zero N                                      | Ctrl + Alt + 2, Cmd + Alt + 2                                                            |
| Relationship - One Only                                    | Ctrl + Alt + 3, Cmd + Alt + 3                                                            |
| Relationship - One N                                       | Ctrl + Alt + 4, Cmd + Alt + 4                                                            |
| Zoom In - ERD                                              | Ctrl + Equal, Cmd + Equal                                                                |
| Zoom Out - ERD                                             | Ctrl + Minus, Cmd + Minus                                                                |
