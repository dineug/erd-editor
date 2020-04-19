import { html, customElement, property } from "lit-element";
import { repeat } from "lit-html/directives/repeat";
import { unsafeHTML } from "lit-html/directives/unsafe-html";
import { Subscription } from "rxjs";
import { EditorElement } from "../EditorElement";
import { Logger } from "@src/core/Logger";
import { databaseHints, DataTypeHint } from "@src/core/DataType";
import { markToHTML } from "@src/core/Helper";

interface Hint {
  name: string;
  html: string;
  active: boolean;
}

@customElement("vuerd-column-data-type-hint")
class ColumnDataTypeHint extends EditorElement {
  @property({ type: String })
  value = "";
  @property({ type: Array })
  hints: Hint[] = [];

  get dataTypeHints() {
    const { canvasState } = this.context.store;
    let dataTypeHints: DataTypeHint[] = [];
    for (const databaseHint of databaseHints) {
      if (databaseHint.database === canvasState.database) {
        dataTypeHints = databaseHint.dataTypeHints;
        break;
      }
    }
    return dataTypeHints;
  }

  connectedCallback() {
    super.connectedCallback();
    this.hintFilter();
  }
  updated(changedProperties: any) {
    Logger.debug("ColumnDataTypeHint updated");
    changedProperties.forEach((oldValue: any, propName: string) => {
      switch (propName) {
        case "value":
          this.hintFilter();
          break;
      }
    });
  }

  render() {
    return html`
      <ul class="vuerd-column-data-type-hint">
        ${repeat(
          this.hints,
          hint => hint.name,
          hint =>
            html`
              <li>
                ${unsafeHTML(hint.html)}
              </li>
            `
        )}
      </ul>
    `;
  }

  private hintFilter() {
    if (this.value.trim() === "") {
      this.hints = this.dataTypeHints.map(dataTypeHint => {
        return {
          name: dataTypeHint.name,
          html: dataTypeHint.name,
          active: false,
        };
      });
    } else {
      this.hints = this.dataTypeHints
        .filter(
          dataTypeHint =>
            dataTypeHint.name
              .toLowerCase()
              .indexOf(this.value.toLowerCase()) !== -1
        )
        .map(dataTypeHint => {
          return {
            name: dataTypeHint.name,
            html: markToHTML("vuerd-mark", dataTypeHint.name, this.value),
            active: false,
          };
        });
    }
  }
}
