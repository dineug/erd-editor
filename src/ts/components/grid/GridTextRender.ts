import { CellRenderer, CellRendererProps } from "tui-grid/types/renderer";

export class GridTextRender implements CellRenderer {
  el: HTMLDivElement;

  constructor(props: CellRendererProps) {
    this.el = document.createElement("div");
    this.el.classList.add("vuerd-grid-text");
    this.render(props);
  }

  getElement() {
    return this.el;
  }
  render(props: CellRendererProps) {
    this.el.innerText = this.getValue(props);
  }

  getValue(props: CellRendererProps) {
    const { placeholder } = props.columnInfo.renderer.options as any;
    const value = String(props.value);
    if (value.trim() === "") {
      this.el.classList.add("placeholder");
      return placeholder;
    } else {
      this.el.classList.remove("placeholder");
      return value;
    }
  }
}
