import { html, customElement, property } from "lit-element";
import { EditorElement } from "../EditorElement";
import { Logger } from "@src/core/Logger";
import { SIZE_MIN_WIDTH } from "@src/core/Layout";

@customElement("vuerd-column-data-type")
class ColumnDataType extends EditorElement {
  @property({ type: Boolean })
  edit = false;
  @property({ type: Boolean })
  focusState = false;
  @property({ type: Boolean })
  select = false;
  @property({ type: Number })
  width = SIZE_MIN_WIDTH;
  @property({ type: String })
  value = "";

  render() {
    return html`
      <div class="vuerd-column-data-type">
        <vuerd-input-edit
          .context=${this.context}
          .width=${this.width}
          .value=${this.value}
          .focusState=${this.focusState}
          .edit=${this.edit}
          .select=${this.select}
          placeholder="dataType"
          @keydown=${this.onKeydown}
        ></vuerd-input-edit>
        ${this.edit
          ? html`
              <vuerd-column-data-type-hint
                .context=${this.context}
                .value=${this.value}
              ></vuerd-column-data-type-hint>
            `
          : html``}
      </div>
    `;
  }

  private onKeydown(event: KeyboardEvent) {
    Logger.debug("ColumnDataType onKeydown");
    switch (event.key) {
      case "ArrowUp":
        break;
      case "ArrowDown":
        break;
      case "ArrowRight":
        break;
      case "ArrowLeft":
        break;
    }
  }
}
