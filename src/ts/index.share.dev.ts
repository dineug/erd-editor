import "./index";
import { ERDEditorElement } from "./types";

document.body.style.margin = "0";
const style = document.createElement("style");
style.innerText = `div { display: inline-block; margin-right: 2px; }`;
document.body.appendChild(style);

function range(num: number): number[] {
  const indexList: number[] = [];
  for (let i = 0; i < num; i++) {
    indexList.push(i);
  }
  return indexList;
}

const editorList: ERDEditorElement[] = [];
range(4).forEach(() => {
  const div = document.createElement("div");
  const editor = document.createElement("erd-editor") as ERDEditorElement;
  div.appendChild(editor);
  document.body.appendChild(div);
  editorList.push(editor);
});

range(3).forEach((i) => {
  editorList[i + 1].blur();
});

editorList.forEach((editor) => {
  editor.sharePull((commands) => {
    editorList.forEach((targetEditor) => {
      if (editor !== targetEditor) {
        targetEditor.sharePush(commands);
      }
    });
  });
});

window.addEventListener("resize", () => {
  const width = window.innerWidth / 2 - 5;
  const height = window.innerHeight / 2 - 5;
  editorList.forEach((editor) => {
    editor.width = width;
    editor.height = height;
  });
});
window.dispatchEvent(new Event("resize"));
