import "./index";

const container = document.querySelector("#app");
if (container) {
  const editor = document.createElement("erd-editor") as any;
  console.log("==========");
  if (editor) {
    console.log(editor);
  }
  console.log("==========");
  container.appendChild(editor);
}
