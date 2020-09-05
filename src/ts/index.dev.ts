import "./index";
import { ERDEditorElement } from "./types";
// @ts-ignore
import Stats from "stats.js";

function setupEditor() {
  document.body.style.margin = "0";
  document.body.style.height = "100vh";

  const editor = document.createElement("erd-editor") as ERDEditorElement;
  editor.automaticLayout = true;
  document.body.appendChild(editor);
}

function setupStats() {
  const stats = new Stats();
  stats.showPanel(0);
  stats.dom.style["z-index"] = 100000000;
  stats.dom.style.top = "50px";
  stats.dom.style.left = "20px";
  document.body.appendChild(stats.dom);

  function animate() {
    stats.begin();
    stats.end();
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}

setupStats();
setupEditor();
