import { storiesOf } from "@storybook/html";
import { Editor } from "../src/ts/types";

const stories = storiesOf("Keymap", module);

function init(editor: Editor) {
  document.body.setAttribute("style", "padding: 0; margin: 0;");
  window.addEventListener("resize", () => {
    editor.width = window.innerWidth;
    editor.height = window.innerHeight;
  });
  window.dispatchEvent(new Event("resize"));
}

stories.add(
  "custom",
  () => {
    const editor = document.createElement("erd-editor") as Editor;
    init(editor);

    editor.setKeymap({
      addTable: [
        {
          metaKey: false,
          ctrlKey: false,
          altKey: true,
          shiftKey: false,
          key: "T",
        },
      ],
      addMemo: [], // remove keymap
    });

    return editor;
  },
  { options: { showPanel: true, panelPosition: "right" } }
);
