import { html, customElement } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { repeat } from "lit-html/directives/repeat";
import { Subscription } from "rxjs";
import { EditorElement } from "./EditorElement";
import { Logger } from "@src/core/Logger";
import { Table } from "@src/core/store/Table";

@customElement("vuerd-canvas")
class Canvas extends EditorElement {
  get theme() {
    const { canvas } = this.context.theme;
    const { width, height } = this.context.store.canvasState;
    return {
      backgroundColor: canvas,
      width: `${width}px`,
      height: `${height}px`,
    };
  }

  private tables: Table[] = [];
  private subscriptionList: Subscription[] = [];

  connectedCallback() {
    super.connectedCallback();
    Logger.debug("Canvas before render");
    const { store } = this.context;
    this.tables = store.tableState.tables;
    this.subscriptionList.push(
      store.observe(this.tables, () => this.requestUpdate())
    );
  }
  disconnectedCallback() {
    Logger.debug("Canvas destroy");
    this.subscriptionList.forEach(sub => sub.unsubscribe());
    super.disconnectedCallback();
  }

  render() {
    Logger.debug("Canvas render");
    return html`
      <div class="vuerd-canvas" style=${styleMap(this.theme)}>
        ${repeat(
          this.tables,
          table => table.id,
          table => html`
            <vuerd-table .context=${this.context} .table=${table}></vuerd-table>
          `
        )}
        <vuerd-canvas-svg .context=${this.context}></vuerd-canvas-svg>
      </div>
    `;
  }
}
