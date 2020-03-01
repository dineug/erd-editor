import "./index";

const container = document.querySelector("#app");
if (container) {
  const editor = document.createElement("erd-editor") as any;
  container.appendChild(editor);
}
