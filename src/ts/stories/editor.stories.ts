import { storiesOf } from "@storybook/html";
import { Editor } from "../types";

const stories = storiesOf("Editor", module);

function init(editor: Editor) {
  document.body.setAttribute("style", "padding: 0; margin: 0;");
  window.addEventListener("resize", () => {
    editor.width = window.innerWidth;
    editor.height = window.innerHeight;
  });
  window.dispatchEvent(new Event("resize"));
}

stories.add(
  "load",
  () => {
    const editor = document.createElement("erd-editor") as Editor;
    init(editor);

    fetch("https://api.github.com/repos/vuerd/vuerd/contents/data/test.json")
      .then((response) => response.json())
      .then((data) => editor.initLoadJson(atob(data.content)));
    // or editor.value = data.content

    return editor;
  },
  { options: { showPanel: true, panelPosition: "right" } }
);

stories.add(
  "change",
  () => {
    const editor = document.createElement("erd-editor") as Editor;
    init(editor);

    editor.addEventListener("change", (event) => {
      const el = event.target as Editor;
      console.log(`change event editor data: \n ${el.value}`);
    });

    return editor;
  },
  { options: { showPanel: true, panelPosition: "right" } }
);
