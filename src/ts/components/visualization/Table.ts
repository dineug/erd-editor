import { html, customElement } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { repeat } from "lit-html/directives/repeat";
import { EditorElement } from "@src/components/EditorElement";
import { Logger } from "@src/core/Logger";
import { Table as TableModel } from "@src/core/store/Table";

@customElement("vuerd-visualization-table")
class Table extends EditorElement {
  table!: TableModel;
  columnId: string | null = null;
  top = 0;
  left = 0;

  connectedCallback() {
    super.connectedCallback();
    const { store } = this.context;
    this.subscriptionList.push(
      store.observe(this.table.ui, () => this.requestUpdate()),
      store.observe(this.table.columns, () => this.requestUpdate()),
      store.observe(store.canvasState.show, (name) => {
        switch (name) {
          case "tableComment":
          case "columnComment":
          case "columnDataType":
          case "columnDefault":
          case "columnNotNull":
            this.requestUpdate();
            break;
        }
      })
    );
  }

  render() {
    const { show } = this.context.store.canvasState;
    const widthColumn = this.table.maxWidthColumn();
    return html`
      <div
        class="vuerd-table"
        style=${styleMap({
          top: `${this.top}px`,
          left: `${this.left}px`,
          width: `${this.table.width()}px`,
          height: `${this.table.height()}px`,
        })}
      >
        <div class="vuerd-table-header">
          <div class="vuerd-table-header-top"></div>
          <div class="vuerd-table-header-body">
            <vuerd-input-edit
              class="vuerd-table-name"
              .width=${this.table.ui.widthName}
              .value=${this.table.name}
              placeholder="table"
            ></vuerd-input-edit>
            ${show.tableComment
              ? html`
                  <vuerd-input-edit
                    class="vuerd-table-comment"
                    .width=${this.table.ui.widthComment}
                    .value=${this.table.comment}
                    placeholder="comment"
                  ></vuerd-input-edit>
                `
              : ""}
          </div>
        </div>
        <div class="vuerd-table-body">
          ${repeat(
            this.table.columns,
            (column) => column.id,
            (column) =>
              html`
                <vuerd-visualization-column
                  .column=${column}
                  .active=${this.columnId === column.id}
                  .widthName=${widthColumn.name}
                  .widthDataType=${widthColumn.dataType}
                  .widthNotNull=${widthColumn.notNull}
                  .widthDefault=${widthColumn.default}
                  .widthComment=${widthColumn.comment}
                  @request-update=${() => this.requestUpdate()}
                ></vuerd-visualization-column>
              `
          )}
        </div>
      </div>
    `;
  }
}
