import { storiesOf } from "@storybook/html";
import { ERDEditorElement } from "../types";

const stories = storiesOf("Theme", module);

const data =
  '{"canvas":{"width":2000,"height":2000,"scrollTop":0,"scrollLeft":0,"show":{"tableComment":true,"columnComment":true,"columnDataType":true,"columnDefault":true,"columnAutoIncrement":false,"columnPrimaryKey":true,"columnUnique":false,"columnNotNull":true,"relationship":true},"database":"MySQL","databaseName":"","canvasType":"ERD","language":"GraphQL","tableCase":"pascalCase","columnCase":"camelCase","setting":{"relationshipDataTypeSync":true,"columnOrder":["columnName","columnDataType","columnNotNull","columnUnique","columnAutoIncrement","columnDefault","columnComment"]}},"table":{"tables":[{"name":"","comment":"","columns":[],"ui":{"active":true,"left":200,"top":100,"zIndex":2,"widthName":60,"widthComment":60},"id":"fe22f1a1-dc76-5282-8f92-27811942814f"}],"indexes":[]},"memo":{"memos":[]},"relationship":{"relationships":[]}}';
function init(editor: ERDEditorElement) {
  document.body.setAttribute("style", "padding: 0; margin: 0;");
  window.addEventListener("resize", () => {
    editor.width = window.innerWidth;
    editor.height = window.innerHeight;
  });
  window.dispatchEvent(new Event("resize"));
}

stories.add(
  "default",
  () => {
    const container = document.createElement("div");
    const editor = document.createElement("erd-editor") as ERDEditorElement;
    container.appendChild(editor);
    init(editor);
    editor.value = data;

    return container;
  },
  { options: { showPanel: false } }
);

stories.add(
  "abyss",
  () => {
    const container = document.createElement("div");
    const editor = document.createElement("erd-editor") as ERDEditorElement;
    const style = document.createElement("style");
    container.appendChild(editor);
    container.appendChild(style);
    init(editor);
    editor.value = data;

    style.innerText = `
      :root {
        --vuerd-theme-canvas: #000c18;
        --vuerd-theme-table: #060621;
        --vuerd-theme-table-active: #ddbb88;
        --vuerd-theme-focus: #ddbb88;
        --vuerd-theme-key-pk: #b4b400;
        --vuerd-theme-key-fk: #dda8b1;
        --vuerd-theme-key-pfk: #60b9c4;
        --vuerd-theme-font: #cccccc;
        --vuerd-theme-font-active: #ffffff;
        --vuerd-theme-font-placeholder: rgba(204, 204, 204, 0.5);
        --vuerd-theme-contextmenu: #181f2f;
        --vuerd-theme-contextmenu-active: #08286b;
        --vuerd-theme-edit: #ffc107;
        --vuerd-theme-column-select: #08286b;
        --vuerd-theme-column-active: #061940;
        --vuerd-theme-minimap-shadow: #000000;
        --vuerd-theme-scrollbar-thumb: rgba(31, 34, 48, 0.67);
        --vuerd-theme-scrollbar-thumb-active: rgba(59, 63, 81, 0.53);
        --vuerd-theme-menubar: #051336;
        --vuerd-theme-visualization: #000c18;
      }
    `;

    return container;
  },
  { options: { showPanel: false } }
);

stories.add(
  "kimbie-dark",
  () => {
    const container = document.createElement("div");
    const editor = document.createElement("erd-editor") as ERDEditorElement;
    const style = document.createElement("style");
    container.appendChild(editor);
    container.appendChild(style);
    init(editor);
    editor.value = data;

    style.innerText = `
      :root {
        --vuerd-theme-canvas: #221a0f;
        --vuerd-theme-table: #362712;
        --vuerd-theme-table-active: #d3af86;
        --vuerd-theme-focus: #d3af86;
        --vuerd-theme-key-pk: #b4b400;
        --vuerd-theme-key-fk: #dda8b1;
        --vuerd-theme-key-pfk: #60b9c4;
        --vuerd-theme-font: #cccccc;
        --vuerd-theme-font-active: #ffffff;
        --vuerd-theme-font-placeholder: rgba(204, 204, 204, 0.5);
        --vuerd-theme-contextmenu: #362712;
        --vuerd-theme-contextmenu-active: #7c5021;
        --vuerd-theme-edit: #ffc107;
        --vuerd-theme-column-select: #7c5021;
        --vuerd-theme-column-active: rgba(124, 80, 33, 0.4);
        --vuerd-theme-minimap-shadow: #000000;
        --vuerd-theme-scrollbar-thumb: rgba(121, 121, 121, 0.4);
        --vuerd-theme-scrollbar-thumb-active: rgba(100, 100, 100, 0.7);
        --vuerd-theme-menubar: #221a0f;
        --vuerd-theme-visualization: #221a0f;
      }
    `;

    return container;
  },
  { options: { showPanel: false } }
);

stories.add(
  "monokai",
  () => {
    const container = document.createElement("div");
    const editor = document.createElement("erd-editor") as ERDEditorElement;
    const style = document.createElement("style");
    container.appendChild(editor);
    container.appendChild(style);
    init(editor);
    editor.value = data;

    style.innerText = `
      :root {
        --vuerd-theme-canvas: #272822;
        --vuerd-theme-table: #1e1f1c;
        --vuerd-theme-table-active: #f8f8f0;
        --vuerd-theme-focus: #f8f8f0;
        --vuerd-theme-key-pk: #b4b400;
        --vuerd-theme-key-fk: #dda8b1;
        --vuerd-theme-key-pfk: #60b9c4;
        --vuerd-theme-font: #cccccc;
        --vuerd-theme-font-active: #ffffff;
        --vuerd-theme-font-placeholder: rgba(204, 204, 204, 0.5);
        --vuerd-theme-contextmenu: #1e1f1c;
        --vuerd-theme-contextmenu-active: #75715e;
        --vuerd-theme-edit: #ffc107;
        --vuerd-theme-column-select: #75715e;
        --vuerd-theme-column-active: #3e3d32;
        --vuerd-theme-minimap-shadow: #000000;
        --vuerd-theme-scrollbar-thumb: rgba(121, 121, 121, 0.4);
        --vuerd-theme-scrollbar-thumb-active: rgba(100, 100, 100, 0.7);
        --vuerd-theme-menubar: #272822;
        --vuerd-theme-visualization: #272822;
      }
    `;

    return container;
  },
  { options: { showPanel: false } }
);

stories.add(
  "monokai-dimmed",
  () => {
    const container = document.createElement("div");
    const editor = document.createElement("erd-editor") as ERDEditorElement;
    const style = document.createElement("style");
    container.appendChild(editor);
    container.appendChild(style);
    init(editor);
    editor.value = data;

    style.innerText = `
      :root {
        --vuerd-theme-canvas: #1e1e1e;
        --vuerd-theme-table: #272727;
        --vuerd-theme-table-active: #c07020;
        --vuerd-theme-focus: #c07020;
        --vuerd-theme-key-pk: #b4b400;
        --vuerd-theme-key-fk: #dda8b1;
        --vuerd-theme-key-pfk: #60b9c4;
        --vuerd-theme-font: #cccccc;
        --vuerd-theme-font-active: #ffffff;
        --vuerd-theme-font-placeholder: rgba(204, 204, 204, 0.5);
        --vuerd-theme-contextmenu: #272727;
        --vuerd-theme-contextmenu-active: #707070;
        --vuerd-theme-edit: #ffc107;
        --vuerd-theme-column-select: #707070;
        --vuerd-theme-column-active: #444444;
        --vuerd-theme-minimap-shadow: #000000;
        --vuerd-theme-scrollbar-thumb: rgba(121, 121, 121, 0.4);
        --vuerd-theme-scrollbar-thumb-active: rgba(100, 100, 100, 0.7);
        --vuerd-theme-menubar: #353535;
        --vuerd-theme-visualization: #1e1e1e;
      }
    `;

    return container;
  },
  { options: { showPanel: false } }
);

stories.add(
  "one-dark-pro",
  () => {
    const container = document.createElement("div");
    const editor = document.createElement("erd-editor") as ERDEditorElement;
    const style = document.createElement("style");
    container.appendChild(editor);
    container.appendChild(style);
    init(editor);
    editor.value = data;

    style.innerText = `
      :root {
        --vuerd-theme-canvas: #282c34;
        --vuerd-theme-table: #21252b;
        --vuerd-theme-table-active: #528bff;
        --vuerd-theme-focus: #528bff;
        --vuerd-theme-key-pk: #b4b400;
        --vuerd-theme-key-fk: #dda8b1;
        --vuerd-theme-key-pfk: #60b9c4;
        --vuerd-theme-font: #cccccc;
        --vuerd-theme-font-active: #ffffff;
        --vuerd-theme-font-placeholder: rgba(204, 204, 204, 0.5);
        --vuerd-theme-contextmenu: #21252b;
        --vuerd-theme-contextmenu-active: #2c313a;
        --vuerd-theme-edit: #ffc107;
        --vuerd-theme-column-select: #2c313a;
        --vuerd-theme-column-active: #292d35;
        --vuerd-theme-minimap-shadow: #000000;
        --vuerd-theme-scrollbar-thumb: rgba(78, 86, 102, 0.38);
        --vuerd-theme-scrollbar-thumb-active: rgba(90, 99, 117, 0.5);
        --vuerd-theme-menubar: #21252b;
        --vuerd-theme-visualization: #282c34;
      }
    `;

    return container;
  },
  { options: { showPanel: false } }
);

stories.add(
  "red",
  () => {
    const container = document.createElement("div");
    const editor = document.createElement("erd-editor") as ERDEditorElement;
    const style = document.createElement("style");
    container.appendChild(editor);
    container.appendChild(style);
    init(editor);
    editor.value = data;

    style.innerText = `
      :root {
        --vuerd-theme-canvas: #390000;
        --vuerd-theme-table: #330000;
        --vuerd-theme-table-active: #970000;
        --vuerd-theme-focus: #970000;
        --vuerd-theme-key-pk: #b4b400;
        --vuerd-theme-key-fk: #dda8b1;
        --vuerd-theme-key-pfk: #60b9c4;
        --vuerd-theme-font: #cccccc;
        --vuerd-theme-font-active: #ffffff;
        --vuerd-theme-font-placeholder: rgba(204, 204, 204, 0.5);
        --vuerd-theme-contextmenu: #580000;
        --vuerd-theme-contextmenu-active: #880000;
        --vuerd-theme-edit: #ffc107;
        --vuerd-theme-column-select: #880000;
        --vuerd-theme-column-active: #800000;
        --vuerd-theme-minimap-shadow: #000000;
        --vuerd-theme-scrollbar-thumb: rgba(121, 121, 121, 0.4);
        --vuerd-theme-scrollbar-thumb-active: rgba(100, 100, 100, 0.7);
        --vuerd-theme-menubar: #580000;
        --vuerd-theme-visualization: #390000;
      }
    `;

    return container;
  },
  { options: { showPanel: false } }
);

stories.add(
  "solarized-dark",
  () => {
    const container = document.createElement("div");
    const editor = document.createElement("erd-editor") as ERDEditorElement;
    const style = document.createElement("style");
    container.appendChild(editor);
    container.appendChild(style);
    init(editor);
    editor.value = data;

    style.innerText = `
      :root {
        --vuerd-theme-canvas: #002b36;
        --vuerd-theme-table: #00212b;
        --vuerd-theme-table-active: #d30102;
        --vuerd-theme-focus: #d30102;
        --vuerd-theme-key-pk: #b4b400;
        --vuerd-theme-key-fk: #dda8b1;
        --vuerd-theme-key-pfk: #60b9c4;
        --vuerd-theme-font: #93a1a1;
        --vuerd-theme-font-active: #ffffff;
        --vuerd-theme-font-placeholder: rgba(147, 161, 161, 0.67);
        --vuerd-theme-contextmenu: #00212b;
        --vuerd-theme-contextmenu-active: #005a6f;
        --vuerd-theme-edit: #ffc107;
        --vuerd-theme-column-select: #005a6f;
        --vuerd-theme-column-active: rgb(0, 68, 84);
        --vuerd-theme-minimap-shadow: #000000;
        --vuerd-theme-scrollbar-thumb: rgba(121, 121, 121, 0.4);
        --vuerd-theme-scrollbar-thumb-active: rgba(100, 100, 100, 0.7);
        --vuerd-theme-menubar: #003847;
        --vuerd-theme-visualization: #002b36;
      }
    `;

    return container;
  },
  { options: { showPanel: false } }
);

stories.add(
  "solarized-light",
  () => {
    const container = document.createElement("div");
    const editor = document.createElement("erd-editor") as ERDEditorElement;
    const style = document.createElement("style");
    container.appendChild(editor);
    container.appendChild(style);
    init(editor);
    editor.value = data;

    style.innerText = `
      :root {
        --vuerd-theme-canvas: #fdf6e3;
        --vuerd-theme-table: #eee8d5;
        --vuerd-theme-table-active: #657b83;
        --vuerd-theme-focus: #657b83;
        --vuerd-theme-key-pk: #b4b400;
        --vuerd-theme-key-fk: #dda8b1;
        --vuerd-theme-key-pfk: #60b9c4;
        --vuerd-theme-font: #586e75;
        --vuerd-theme-font-active: #000000;
        --vuerd-theme-font-placeholder: rgba(88, 110, 117, 0.67);
        --vuerd-theme-contextmenu: #eee8d5;
        --vuerd-theme-contextmenu-active: #dfca88;
        --vuerd-theme-edit: #ffc107;
        --vuerd-theme-column-select: #dfca88;
        --vuerd-theme-column-active: rgb(223, 202, 136);
        --vuerd-theme-minimap-shadow: #a8a8a8;
        --vuerd-theme-scrollbar-thumb: rgba(100, 100, 100, 0.4);
        --vuerd-theme-scrollbar-thumb-active: rgba(100, 100, 100, 0.7);
        --vuerd-theme-menubar: #ddd6c1;
        --vuerd-theme-visualization: #fdf6e3;
      }
    `;

    return container;
  },
  { options: { showPanel: false } }
);

stories.add(
  "tomorrow-night-blue",
  () => {
    const container = document.createElement("div");
    const editor = document.createElement("erd-editor") as ERDEditorElement;
    const style = document.createElement("style");
    container.appendChild(editor);
    container.appendChild(style);
    init(editor);
    editor.value = data;

    style.innerText = `
      :root {
        --vuerd-theme-canvas: #002451;
        --vuerd-theme-table: #001c40;
        --vuerd-theme-table-active: #ffffff;
        --vuerd-theme-focus: #ffffff;
        --vuerd-theme-key-pk: #b4b400;
        --vuerd-theme-key-fk: #dda8b1;
        --vuerd-theme-key-pfk: #60b9c4;
        --vuerd-theme-font: #cccccc;
        --vuerd-theme-font-active: #ffffff;
        --vuerd-theme-font-placeholder: rgba(204, 204, 204, 0.5);
        --vuerd-theme-contextmenu: #001733;
        --vuerd-theme-contextmenu-active: rgba(255, 255, 255, 0.38);
        --vuerd-theme-edit: #ffc107;
        --vuerd-theme-column-select: rgb(100, 100, 100);
        --vuerd-theme-column-active: rgb(120, 120, 120);
        --vuerd-theme-minimap-shadow: #000000;
        --vuerd-theme-scrollbar-thumb: rgba(121, 121, 121, 0.4);
        --vuerd-theme-scrollbar-thumb-active: rgba(100, 100, 100, 0.7);
        --vuerd-theme-menubar: #001733;
        --vuerd-theme-visualization: #002451;
      }
    `;

    return container;
  },
  { options: { showPanel: false } }
);

stories.add(
  "vscode-dark",
  () => {
    const container = document.createElement("div");
    const editor = document.createElement("erd-editor") as ERDEditorElement;
    const style = document.createElement("style");
    container.appendChild(editor);
    container.appendChild(style);
    init(editor);
    editor.value = data;

    style.innerText = `
      :root {
        --vuerd-theme-canvas: #1e1e1e;
        --vuerd-theme-table: #252526;
        --vuerd-theme-table-active: #aeafad;
        --vuerd-theme-focus: #aeafad;
        --vuerd-theme-key-pk: #b4b400;
        --vuerd-theme-key-fk: #dda8b1;
        --vuerd-theme-key-pfk: #60b9c4;
        --vuerd-theme-font: #cccccc;
        --vuerd-theme-font-active: #ffffff;
        --vuerd-theme-font-placeholder: #a6a6a6;
        --vuerd-theme-contextmenu: #252526;
        --vuerd-theme-contextmenu-active: #094771;
        --vuerd-theme-edit: #ffc107;
        --vuerd-theme-column-select: #094771;
        --vuerd-theme-column-active: #2a2d2e;
        --vuerd-theme-minimap-shadow: #000000;
        --vuerd-theme-scrollbar-thumb: rgba(121, 121, 121, 0.4);
        --vuerd-theme-scrollbar-thumb-active: rgba(100, 100, 100, 0.7);
        --vuerd-theme-menubar: #333333;
        --vuerd-theme-visualization: #1e1e1e;
      }
    `;

    return container;
  },
  { options: { showPanel: false } }
);
