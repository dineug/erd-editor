import { html, customElement } from "lit-element";
import { Subscription } from "rxjs";
import { EditorElement } from "../EditorElement";
import { Logger } from "@src/core/Logger";
import { Column as ColumnModel } from "@src/core/store/Table";

@customElement("vuerd-minimap-column")
class Column extends EditorElement {
  column!: ColumnModel;

  private subscriptionList: Subscription[] = [];

  connectedCallback() {
    super.connectedCallback();
    const { store } = this.context;
    this.subscriptionList.push(
      store.observe(this.column.ui, name => {
        switch (name) {
          case "widthName":
          case "widthComment":
          case "widthDataType":
          case "widthDefault":
            this.dispatchEvent(new CustomEvent("request-update"));
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
    return html``;
  }
}
