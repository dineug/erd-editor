import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { classMap } from "lit-html/directives/class-map";
import { EditorElement } from "@src/components/EditorElement";
import { Logger } from "@src/core/Logger";
import { ColumnOption } from "@src/core/store/Table";
import { SIZE_COLUMN_OPTION_QU } from "@src/core/Layout";

@customElement("vuerd-column-unique")
class ColumnUnique extends EditorElement {
  @property({ type: Boolean })
  focusState = false;

  columnOption!: ColumnOption;

  connectedCallback() {
    super.connectedCallback();
    const { store } = this.context;
    this.subscriptionList.push(
      store.observe(this.columnOption, (name) => {
        if (name === "unique") {
          this.requestUpdate();
        }
      })
    );
  }

  render() {
    return html`
      <div
        class=${classMap({
          "vuerd-column-unique": true,
          focus: this.focusState,
          checked: this.columnOption.unique,
        })}
        style=${styleMap({
          width: `${SIZE_COLUMN_OPTION_QU}px`,
        })}
        title="Unique"
      >
        UQ
      </div>
    `;
  }
}
