import { storiesOf } from "@storybook/html";
import { ERDEditorElement } from "../types";

const stories = storiesOf("Editor", module);

function init(editor: ERDEditorElement) {
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
    const editor = document.createElement("erd-editor") as ERDEditorElement;
    init(editor);

    fetch("https://api.github.com/repos/vuerd/vuerd/contents/data/test.json")
      .then((response) => response.json())
      .then((data) => editor.initLoadJson(atob(data.content)));
    // or editor.value = atob(data.content)

    return editor;
  },
  { options: { showPanel: true, panelPosition: "right" } }
);

stories.add(
  "change",
  () => {
    const editor = document.createElement("erd-editor") as ERDEditorElement;
    init(editor);

    editor.addEventListener("change", (event) => {
      const el = event.target as ERDEditorElement;
      console.log(`change event editor data: \n ${el.value}`);
    });

    return editor;
  },
  { options: { showPanel: true, panelPosition: "right" } }
);

stories.add(
  "share",
  () => {
    const container = document.createElement("div");
    const editor = document.createElement("erd-editor") as ERDEditorElement;
    const editor2 = document.createElement("erd-editor") as ERDEditorElement;
    container.appendChild(editor);
    container.appendChild(editor2);
    document.body.setAttribute("style", "padding: 0; margin: 0;");
    window.addEventListener("resize", () => {
      const width = window.innerWidth;
      const height = window.innerHeight / 2;
      editor.width = width;
      editor.height = height;
      editor2.width = width;
      editor2.height = height;
    });
    window.dispatchEvent(new Event("resize"));

    editor.setUser({ name: "user1" });
    editor2.setUser({ name: "user2" });
    // websocket
    editor.sharePull((commands) => {
      editor2.sharePush(commands);
    });
    editor2.sharePull((commands) => {
      editor.sharePush(commands);
    });

    return container;
  },
  { options: { showPanel: true, panelPosition: "right" } }
);
