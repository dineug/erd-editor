import { CellEditor, CellEditorProps } from "tui-grid/types/editor";

export class GridTextEditor implements CellEditor {
  props: CellEditorProps;
  el: HTMLInputElement;

  constructor(props: CellEditorProps) {
    const { placeholder } = props.columnInfo.renderer.options as any;
    this.props = props;
    this.el = document.createElement("input");
    this.el.classList.add("vuerd-grid-input");
    this.el.type = "text";
    this.el.spellcheck = false;
    this.el.value = String(props.value);
    this.el.addEventListener("blur", this.onBlur);
    if (placeholder) {
      this.el.placeholder = placeholder;
    }
  }

  getElement() {
    return this.el;
  }
  getValue() {
    return this.el.value;
  }
  mounted() {
    this.el.focus();
  }
  beforeDestroy() {
    this.el.removeEventListener("blur", this.onBlur);
  }

  private onBlur = () => {
    this.props.grid.finishEditing(this.props.rowKey, this.el.value);
  };
}
