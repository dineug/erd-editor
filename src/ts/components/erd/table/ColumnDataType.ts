import { html, customElement, property } from "lit-element";
import { EditorElement } from "@src/components/EditorElement";
import { Logger } from "@src/core/Logger";
import { SIZE_MIN_WIDTH } from "@src/core/Layout";
import { Bus } from "@src/core/Event";

@customElement("vuerd-column-data-type")
class ColumnDataType extends EditorElement {
  @property({ type: Boolean })
  edit = false;
  @property({ type: Boolean })
  focusState = false;
  @property({ type: Boolean })
  select = false;
  @property({ type: Boolean })
  active = false;
  @property({ type: Number })
  width = SIZE_MIN_WIDTH;
  @property({ type: String })
  value = "";

  tableId!: string;
  columnId!: string;

  render() {
    return html`
      <div class="vuerd-column-data-type">
        <vuerd-input-edit
          .width=${this.width}
          .value=${this.value}
          .focusState=${this.focusState}
          .edit=${this.edit}
          .select=${this.select}
          .active=${this.active}
          placeholder="dataType"
          @keydown=${this.onKeydown}
          @blur=${this.onBlur}
          @input=${this.onInput}
        ></vuerd-input-edit>
        ${this.edit
          ? html`
              <vuerd-column-data-type-hint
                .value=${this.value}
                .tableId=${this.tableId}
                .columnId=${this.columnId}
                @blur=${this.onBlurHint}
              ></vuerd-column-data-type-hint>
            `
          : ""}
      </div>
    `;
  }

  private onKeydown(event: KeyboardEvent) {
    const { eventBus } = this.context;
    switch (event.key) {
      case "ArrowUp":
        eventBus.emit(Bus.ColumnDataTypeHint.arrowUp, event);
        break;
      case "ArrowDown":
        eventBus.emit(Bus.ColumnDataTypeHint.arrowDown, event);
        break;
      case "ArrowLeft":
        eventBus.emit(Bus.ColumnDataTypeHint.arrowLeft, event);
        break;
      case "ArrowRight":
        eventBus.emit(Bus.ColumnDataTypeHint.arrowRight, event);
        break;
    }
  }
  private onInput(event: KeyboardEvent) {
    const { eventBus } = this.context;
    eventBus.emit(Bus.ColumnDataTypeHint.startFilter);
  }
  private onBlurHint() {
    this.dispatchEvent(new Event("blur"));
  }
  private onBlur() {
    const input = this.renderRoot.querySelector("input");
    if (input && this.edit) {
      const len = input.value.length;
      input.selectionStart = len;
      input.selectionEnd = len;
      input.focus();
    }
  }
}
