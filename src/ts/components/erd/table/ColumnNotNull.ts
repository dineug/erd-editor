import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { classMap } from "lit-html/directives/class-map";
import { EditorElement } from "@src/components/EditorElement";
import { Logger } from "@src/core/Logger";
import { ColumnOption } from "@src/core/store/Table";
import { SIZE_COLUMN_OPTION_NN } from "@src/core/Layout";

@customElement("vuerd-column-not-null")
class ColumnNotNull extends EditorElement {
  @property({ type: Boolean })
  focusState = false;

  columnOption!: ColumnOption;

  connectedCallback() {
    super.connectedCallback();
    const { store } = this.context;
    this.subscriptionList.push(
      store.observe(this.columnOption, (name) => {
        if (name === "notNull") {
          this.requestUpdate();
        }
      })
    );
  }

  render() {
    return html`
      <div
        class=${classMap({
          "vuerd-column-not-null": true,
          focus: this.focusState,
        })}
        style=${styleMap({
          width: `${SIZE_COLUMN_OPTION_NN}px`,
        })}
      >
        ${this.columnOption.notNull ? "N-N" : "NULL"}
      </div>
    `;
  }
}
