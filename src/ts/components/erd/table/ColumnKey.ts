import { html, customElement } from "lit-element";
import { classMap } from "lit-html/directives/class-map";
import { EditorElement } from "@src/components/EditorElement";
import { Logger } from "@src/core/Logger";
import { ColumnUI } from "@src/core/store/Table";

@customElement("vuerd-column-key")
class ColumnKey extends EditorElement {
  columnUI!: ColumnUI;

  connectedCallback() {
    super.connectedCallback();
    const { store } = this.context;
    this.subscriptionList.push(
      store.observe(this.columnUI, (name) => {
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
        <vuerd-icon size="12" icon="key"></vuerd-icon>
      </div>
    `;
  }
}
