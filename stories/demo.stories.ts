import { storiesOf } from "@storybook/html";
import { Editor } from "../src/ts/types";
import "../dist/vuerd.min.js";

const stories = storiesOf("Demo", module);

function init(editor: Editor) {
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
    const editor = document.createElement("erd-editor") as Editor;
    init(editor);

    return editor;
  },
  { options: { showPanel: false } }
);
