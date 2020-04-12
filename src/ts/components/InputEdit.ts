import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { EditorElement } from "./EditorElement";
import { Logger } from "@src/core/Logger";
import { SIZE_MIN_WIDTH } from "@src/core/Layout";

@customElement("vuerd-input-edit")
class InputEdit extends EditorElement {
  @property({ type: Boolean })
  edit = false;
  @property({ type: Boolean })
  focusState = false;
  @property({ type: Number })
  width = SIZE_MIN_WIDTH;
  @property({ type: String })
  value = "";
  @property({ type: String })
  placeholder = "";
  @property({ type: String })
  backgroundColor = "";

  get theme() {
    const {
      fontActive,
      fontPlaceholder,
      focus,
      table,
      edit,
    } = this.context.theme;
    const theme: any = {
      color: fontActive,
      width: `${this.width}px`,
    };
    if (this.edit) {
      if (this.backgroundColor === "") {
        theme.backgroundColor = table;
      } else {
        theme.backgroundColor = this.backgroundColor;
      }
      theme.borderBottom = `solid ${edit} 1.5px`;
    } else {
      if (this.focusState) {
        theme.borderBottom = `solid ${focus} 1.5px`;
      }
      if (this.value.trim() === "") {
        theme.color = fontPlaceholder;
      }
    }
    return theme;
  }

  get placeholderValue() {
    if (this.value.trim() === "") {
      return this.placeholder;
    }
    return this.value;
  }

  updated(changedProperties: any) {
    Logger.debug("InputEdit updated");
    changedProperties.forEach((oldValue: any, propName: string) => {
      switch (propName) {
        case "edit":
          if (this.edit) {
            const input = this.renderRoot.querySelector("input");
            input?.focus();
          }
          break;
      }
    });
  }

  render() {
    Logger.debug("InputEdit render");
    return this.edit
      ? html`
          <input
            class="vuerd-input-edit"
            style=${styleMap(this.theme)}
            type="text"
            spellcheck="false"
            value=${this.value}
            placeholder=${this.placeholder}
            @blur=${this.onEmit}
          />
        `
      : html`
          <div class="vuerd-input-edit" style=${styleMap(this.theme)}>
            <span>${this.placeholderValue}</span>
          </div>
        `;
  }

  private onEmit = (event: InputEvent) => {
    Logger.debug(`InputEdit onEmit: ${event.type}`);
    if (event.type === "blur") {
      this.dispatchEvent(new Event(event.type));
    }
  };
}
