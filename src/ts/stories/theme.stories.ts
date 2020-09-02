import { storiesOf } from "@storybook/html";
import { ERDEditorElement } from "../types";

const stories = storiesOf("Theme", module);

function init(editor: ERDEditorElement) {
  document.body.setAttribute("style", "padding: 0; margin: 0;");
  window.addEventListener("resize", () => {
    editor.width = window.innerWidth;
    editor.height = window.innerHeight;
  });
  window.dispatchEvent(new Event("resize"));
}

stories.add(
  "css",
  () => {
    const container = document.createElement("div");
    const editor = document.createElement("erd-editor") as ERDEditorElement;
    const style = document.createElement("style");
    container.appendChild(editor);
    container.appendChild(style);
    init(editor);

    style.innerText = `
      :root {
        --vuerd-theme-canvas: #d7d7d7;
        --vuerd-theme-table: #e6e6e6;
        --vuerd-theme-table-active: #ebb692;
        --vuerd-theme-focus: #ff5600;
        --vuerd-theme-key-pk: #B4B400;
        --vuerd-theme-key-fk: #dda8b1;
        --vuerd-theme-key-pfk: #60b9c4;
        --vuerd-theme-font: #5d5d5d;
        --vuerd-theme-font-active: black;
        --vuerd-theme-font-placeholder: #929292;
        --vuerd-theme-contextmenu: #e6e6e6;
        --vuerd-theme-contextmenu-active: #c7c2be;
        --vuerd-theme-edit: #003ef8;
        --vuerd-theme-column-select: #dcd5d0;
        --vuerd-theme-column-active: #c8d6f7;
        --vuerd-theme-minimap-shadow: #5d5d5d;
        --vuerd-theme-scrollbar-thumb: #929292;
        --vuerd-theme-scrollbar-thumb-active: #5d5d5d;
        --vuerd-theme-menubar: white;
        --vuerd-theme-visualization: #d7d7d7;
      }
    `;

    return container;
  },
  { options: { showPanel: true, panelPosition: "right" } }
);

stories.add(
  "javascript",
  () => {
    const editor = document.createElement("erd-editor") as ERDEditorElement;
    init(editor);

    editor.setTheme({
      canvas: "#2f444e",
    });

    return editor;
  },
  { options: { showPanel: true, panelPosition: "right" } }
);
