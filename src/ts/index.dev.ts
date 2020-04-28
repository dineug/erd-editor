import "./index";
import { Editor, Command, CommandType } from "./types";

document.body.style.margin = "0";

const container = document.querySelector("#app");
const container2 = document.querySelector("#app2");
if (container && container2) {
  const editor = document.createElement("erd-editor") as Editor;
  // const editor2 = document.createElement("erd-editor") as Editor;

  // editor.subscribe((commands: Command<CommandType>[]) => {
  //   editor2.next(commands);
  // });
  // editor2.subscribe((commands: Command<CommandType>[]) => {
  //   editor.next(commands);
  // });
  // editor2.blur();

  container.appendChild(editor);
  // container2.appendChild(editor2);
  window.addEventListener("resize", () => {
    editor.width = window.innerWidth;
    // editor.height = window.innerHeight;
  });
  window.dispatchEvent(new Event("resize"));
}
