import { html, customElement } from "lit-element";
import { Subscription } from "rxjs";
import { EditorElement } from "../EditorElement";
import { Logger } from "@src/core/Logger";
import { ColumnUI } from "@src/core/store/Table";

@customElement("vuerd-column-key")
class ColumnKey extends EditorElement {
  columnUI!: ColumnUI;

  private subscriptionList: Subscription[] = [];

  get colorKey() {
    const { keyPK, keyFK, keyPFK } = this.context.theme;
    const { pk, fk, pfk } = this.columnUI;
    if (pk) {
      return keyPK;
    } else if (fk) {
      return keyFK;
    } else if (pfk) {
      return keyPFK;
    } else {
      return "#fff0";
    }
  }

  connectedCallback() {
    super.connectedCallback();
    const { store } = this.context;
    this.subscriptionList.push(
      store.observe(this.columnUI, (name: string | number | symbol) => {
        switch (name) {
          case "pk":
          case "fk":
          case "pfk":
            this.requestUpdate();
            break;
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
      <div class="vuerd-column-key">
        <vuerd-fontawesome
          .context=${this.context}
          size="12"
          icon="key"
          .color=${this.colorKey}
        ></vuerd-fontawesome>
      </div>
    `;
  }
}
