import "./index";
import { ERDEditorElement } from "./types";

document.body.style.margin = "0";

const editor = document.createElement("erd-editor") as ERDEditorElement;
document.body.appendChild(editor);

window.addEventListener("resize", () => {
  editor.width = window.innerWidth;
  editor.height = window.innerHeight;
});
window.dispatchEvent(new Event("resize"));
