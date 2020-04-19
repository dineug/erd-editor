import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { classMap } from "lit-html/directives/class-map";
import { EditorElement } from "./EditorElement";
import { Logger } from "@src/core/Logger";
import { SIZE_MIN_WIDTH } from "@src/core/Layout";

@customElement("vuerd-input-edit")
class InputEdit extends EditorElement {
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
  @property({ type: String })
  placeholder = "";

  get classMap() {
    return {
      "vuerd-input-edit": true,
      placeholder: this.value.trim() === "" && !this.edit,
      focus: this.focusState && !this.edit,
      edit: this.edit,
      select: this.select,
    };
  }

  get placeholderValue() {
    if (this.value.trim() === "") {
      return this.placeholder;
    }
    return this.value;
  }

  updated(changedProperties: any) {
    changedProperties.forEach((oldValue: any, propName: string) => {
      switch (propName) {
        case "edit":
          if (this.edit) {
            const input = this.renderRoot.querySelector("input");
            if (input) {
              const len = input.value.length;
              input.selectionStart = len;
              input.selectionEnd = len;
              input.focus();
            }
          }
          break;
      }
    });
  }

  render() {
    return this.edit
      ? html`
          <input
            class=${classMap(this.classMap)}
            style=${styleMap({
              width: `${this.width}px`,
            })}
            type="text"
            spellcheck="false"
            .value=${this.value}
            placeholder=${this.placeholder}
            @blur=${this.onEmit}
          />
        `
      : html`
          <div
            class=${classMap(this.classMap)}
            style=${styleMap({
              width: `${this.width}px`,
            })}
          >
            <span>${this.placeholderValue}</span>
          </div>
        `;
  }

  private onEmit(event: InputEvent) {
    Logger.debug(`InputEdit onEmit: ${event.type}`);
    if (event.type === "blur") {
      this.dispatchEvent(new Event("blur"));
    }
  }
}
