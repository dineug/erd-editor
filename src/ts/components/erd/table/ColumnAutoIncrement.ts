import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { classMap } from "lit-html/directives/class-map";
import { EditorElement } from "@src/components/EditorElement";
import { Logger } from "@src/core/Logger";
import { ColumnOption } from "@src/core/store/Table";
import { SIZE_COLUMN_OPTION } from "@src/core/Layout";

@customElement("vuerd-column-auto-increment")
class ColumnAutoIncrement extends EditorElement {
  @property({ type: Boolean })
  focusState = false;

  columnOption!: ColumnOption;

  connectedCallback() {
    super.connectedCallback();
    const { store } = this.context;
    this.subscriptionList.push(
      store.observe(this.columnOption, (name) => {
        if (name === "autoIncrement") {
          this.requestUpdate();
        }
      })
    );
  }

  render() {
    return html`
      <div
        class=${classMap({
          "vuerd-column-auto-increment": true,
          focus: this.focusState,
          checked: this.columnOption.autoIncrement,
        })}
        style=${styleMap({
          width: `${SIZE_COLUMN_OPTION}px`,
        })}
        title="Auto Increment"
      >
        <vuerd-icon
          size="19"
          prefix="mdi"
          icon="alpha-a-box-outline"
        ></vuerd-icon>
      </div>
    `;
  }
}
