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
    const { pk, fk, pfk } = this.columnUI;
    return html`
      <div
        class=${classMap({
          "vuerd-column-key": true,
          pk,
          fk,
          pfk,
        })}
      >
        <vuerd-fontawesome size="12" icon="key"></vuerd-fontawesome>
      </div>
    `;
  }
}
