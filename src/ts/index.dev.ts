import "./index";
import { ERDEditorElement } from "./types";

document.body.style.margin = "0";

const editor = document.createElement("erd-editor") as ERDEditorElement;
// const editor2 = document.createElement("erd-editor") as ERDEditorElement;
document.body.appendChild(editor);
// document.body.appendChild(editor2);

// editor2.blur();

window.addEventListener("resize", () => {
  editor.width = window.innerWidth;
  editor.height = window.innerHeight;
  // editor2.width = window.innerWidth;
  // editor2.height = window.innerHeight / 2;
});
window.dispatchEvent(new Event("resize"));
