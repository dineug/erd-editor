import "./index";
import { ERDEditorElement } from "./types";

document.body.style.margin = "0";
document.body.style.height = "100vh";

const editor = document.createElement("erd-editor") as ERDEditorElement;
editor.automaticLayout = true;
document.body.appendChild(editor);
