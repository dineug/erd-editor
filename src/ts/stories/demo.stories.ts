import { storiesOf } from "@storybook/html";
import { ERDEditorElement } from "../types";

const stories = storiesOf("Demo", module);

function init(editor: ERDEditorElement) {
  document.body.setAttribute("style", "padding: 0; margin: 0;");
  window.addEventListener("resize", () => {
    editor.width = window.innerWidth;
    editor.height = window.innerHeight;
  });
  window.dispatchEvent(new Event("resize"));
}

stories.add(
  "Live",
  () => {
    const editor = document.createElement("erd-editor") as ERDEditorElement;
    init(editor);

    return editor;
  },
  { options: { showPanel: false } }
);
