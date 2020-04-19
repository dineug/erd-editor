import { html, customElement } from "lit-element";
import { classMap } from "lit-html/directives/class-map";
import { Subscription } from "rxjs";
import { EditorElement } from "../EditorElement";
import { Logger } from "@src/core/Logger";
import { ColumnUI } from "@src/core/store/Table";

@customElement("vuerd-column-key")
class ColumnKey extends EditorElement {
  columnUI!: ColumnUI;

  private subscriptionList: Subscription[] = [];

  get classMap() {
    const { pk, fk, pfk } = this.columnUI;
    return {
      "vuerd-column-key": true,
      pk,
      fk,
      pfk,
    };
  }

  connectedCallback() {
    super.connectedCallback();
    const { store } = this.context;
    this.subscriptionList.push(
      store.observe(this.columnUI, name => {
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
      <div class=${classMap(this.classMap)}>
        <vuerd-fontawesome
          .context=${this.context}
          size="12"
          icon="key"
        ></vuerd-fontawesome>
      </div>
    `;
  }
}
