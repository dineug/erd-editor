import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { Subscription } from "rxjs";
import { EditorElement } from "../EditorElement";
import { Logger } from "@src/core/Logger";
import { ColumnOption } from "@src/core/store/Table";
import { SIZE_COLUMN_OPTION_NN } from "@src/core/Layout";

@customElement("vuerd-column-not-null")
class ColumnNotNull extends EditorElement {
  @property({ type: Boolean })
  focusState = false;

  columnOption!: ColumnOption;

  private subscriptionList: Subscription[] = [];

  get theme() {
    const { fontActive, focus } = this.context.theme;
    const theme: any = {
      color: fontActive,
      width: `${SIZE_COLUMN_OPTION_NN}px`,
    };
    if (this.focusState) {
      theme.borderBottom = `solid ${focus} 1.5px`;
    }
    return theme;
  }

  connectedCallback() {
    super.connectedCallback();
    const { store } = this.context;
    this.subscriptionList.push(
      store.observe(this.columnOption, (name: string | number | symbol) => {
        if (name === "notNull") {
          this.requestUpdate();
        }
      })
    );
  }
  disconnectedCallback() {
    this.subscriptionList.forEach(sub => sub.unsubscribe());
    super.disconnectedCallback();
  }

  render() {
    return html`
      <div class="vuerd-column-not-null" style=${styleMap(this.theme)}>
        ${this.columnOption.notNull ? "N-N" : "NULL"}
      </div>
    `;
  }
}
