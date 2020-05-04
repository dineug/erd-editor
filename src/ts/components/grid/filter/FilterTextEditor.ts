import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { classMap } from "lit-html/directives/class-map";
import { Subscription, fromEvent } from "rxjs";
import { EditorElement } from "@src/components/EditorElement";
import { Logger } from "@src/core/Logger";

@customElement("vuerd-grid-filter-text-editor")
class FilterTextEditor extends EditorElement {
  @property({ type: Boolean })
  edit = false;
  @property({ type: Boolean })
  focusState = false;
  @property({ type: Boolean })
  select = false;
  @property({ type: String })
  value = "";
  @property({ type: String })
  placeholder = "";

  get classMap() {
    return {
      "vuerd-grid-filter-text-editor": true,
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
            type="text"
            spellcheck="false"
            .value=${this.value}
            placeholder=${this.placeholder}
            @blur=${this.onBlur}
          />
        `
      : html`
          <div class=${classMap(this.classMap)}>
            <span>${this.placeholderValue}</span>
          </div>
        `;
  }

  private onBlur(event: InputEvent) {
    this.dispatchEvent(new Event("blur"));
  }
}
