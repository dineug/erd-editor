import { html, customElement } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { repeat } from "lit-html/directives/repeat";
import { Subscription } from "rxjs";
import { EditorElement } from "./EditorElement";
import { Logger } from "@src/core/Logger";
import { Table } from "@src/core/store/Table";
import { Memo } from "@src/core/store/Memo";

@customElement("vuerd-canvas")
class Canvas extends EditorElement {
  private tables: Table[] = [];
  private memos: Memo[] = [];
  private subscriptionList: Subscription[] = [];

  connectedCallback() {
    super.connectedCallback();
    Logger.debug("Canvas before render");
    const { store } = this.context;
    this.tables = store.tableState.tables;
    this.memos = store.memoState.memos;
    this.subscriptionList.push.apply(this.subscriptionList, [
      store.observe(this.tables, () => this.requestUpdate()),
      store.observe(this.memos, () => this.requestUpdate()),
      store.observe(store.canvasState, name => {
        switch (name) {
          case "width":
          case "height":
            this.requestUpdate();
            break;
        }
      }),
    ]);
  }
  disconnectedCallback() {
    Logger.debug("Canvas destroy");
    this.subscriptionList.forEach(sub => sub.unsubscribe());
    super.disconnectedCallback();
  }

  render() {
    Logger.debug("Canvas render");
    const { width, height } = this.context.store.canvasState;
    return html`
      <div
        class="vuerd-canvas"
        style=${styleMap({
          width: `${width}px`,
          height: `${height}px`,
        })}
      >
        ${repeat(
          this.tables,
          table => table.id,
          table => html`
            <vuerd-table .table=${table}></vuerd-table>
          `
        )}
        ${repeat(
          this.memos,
          memo => memo.id,
          memo =>
            html`
              <vuerd-memo .memo=${memo}></vuerd-memo>
            `
        )}
        <vuerd-canvas-svg></vuerd-canvas-svg>
      </div>
    `;
  }
}
