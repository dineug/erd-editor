import { html, customElement } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { classMap } from "lit-html/directives/class-map";
import { repeat } from "lit-html/directives/repeat";
import { Subscription } from "rxjs";
import { EditorElement } from "../EditorElement";
import { Logger } from "@src/core/Logger";
import { Table as TableModel } from "@src/core/store/Table";

@customElement("vuerd-minimap-table")
class Table extends EditorElement {
  table!: TableModel;

  private subscriptionList: Subscription[] = [];

  connectedCallback() {
    super.connectedCallback();
    const { store } = this.context;
    this.subscriptionList.push.apply(this.subscriptionList, [
      store.observe(this.table.ui, () => this.requestUpdate()),
      store.observe(this.table.columns, () => this.requestUpdate()),
      store.observe(store.canvasState.show, name => {
        switch (name) {
          case "tableComment":
          case "columnComment":
          case "columnDataType":
          case "columnDefault":
          case "columnNotNull":
            this.requestUpdate();
            break;
        }
      }),
    ]);
  }
  disconnectedCallback() {
    this.subscriptionList.forEach(sub => sub.unsubscribe());
    super.disconnectedCallback();
  }

  render() {
    const { ui } = this.table;
    return html`
      <div
        class=${classMap({
          "vuerd-table": true,
          active: ui.active,
        })}
        style=${styleMap({
          top: `${ui.top}px`,
          left: `${ui.left}px`,
          zIndex: `${ui.zIndex}`,
          width: `${this.table.width()}px`,
          height: `${this.table.height()}px`,
        })}
      >
        ${repeat(
          this.table.columns,
          column => column.id,
          column =>
            html`
              <vuerd-minimap-column
                .context=${this.context}
                .column=${column}
                @request-update=${() => this.requestUpdate()}
              ></vuerd-minimap-column>
            `
        )}
      </div>
    `;
  }
}
