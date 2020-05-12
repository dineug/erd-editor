import "./index";
import { Editor } from "./types";

document.body.style.margin = "0";

const container = document.querySelector("#app");
if (container) {
  const editor = document.createElement("erd-editor") as Editor;
  container.appendChild(editor);
  editor.addEventListener("change", (event) => {
    console.log(event.target);
  });
  window.addEventListener("resize", () => {
    editor.width = window.innerWidth;
    editor.height = window.innerHeight;
  });
  window.dispatchEvent(new Event("resize"));
}
