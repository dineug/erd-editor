import { html, customElement, property, TemplateResult } from "lit-element";
import { classMap } from "lit-html/directives/class-map";
import { EditorElement } from "@src/components/EditorElement";
import { Logger } from "@src/core/Logger";
import { SIZE_MIN_WIDTH } from "@src/core/Layout";
import { Column as ColumnModel } from "@src/core/store/Table";

@customElement("vuerd-visualization-column")
class Column extends EditorElement {
  @property({ type: Boolean })
  active = false;
  @property({ type: Number })
  widthName = SIZE_MIN_WIDTH;
  @property({ type: Number })
  widthDataType = SIZE_MIN_WIDTH;
  @property({ type: Number })
  widthNotNull = SIZE_MIN_WIDTH;
  @property({ type: Number })
  widthDefault = SIZE_MIN_WIDTH;
  @property({ type: Number })
  widthComment = SIZE_MIN_WIDTH;

  column!: ColumnModel;

  connectedCallback() {
    super.connectedCallback();
    const { store } = this.context;
    this.subscriptionList.push(
      store.observe(store.canvasState.show, () => this.requestUpdate()),
      store.observe(this.column.ui, (name) => {
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

  render() {
    const { show, setting } = this.context.store.canvasState;
    const { ui, option } = this.column;
    const columns: TemplateResult[] = [];
    setting.columnOrder.forEach((columnType) => {
      switch (columnType) {
        case "columnName":
          columns.push(html`
            <vuerd-input-edit
              .width=${this.widthName}
              .value=${this.column.name}
              .active=${this.active}
              placeholder="column"
            ></vuerd-input-edit>
          `);
          break;
        case "columnDataType":
          if (show.columnDataType) {
            columns.push(html`
              <vuerd-input-edit
                .width=${this.widthDataType}
                .value=${this.column.dataType}
                .active=${this.active}
                placeholder="dataType"
              ></vuerd-input-edit>
            `);
          }
          break;
        case "columnNotNull":
          if (show.columnNotNull) {
            columns.push(html`
              <vuerd-column-not-null
                .columnOption=${this.column.option}
              ></vuerd-column-not-null>
            `);
          }
          break;
        case "columnDefault":
          if (show.columnDefault) {
            columns.push(html`
              <vuerd-input-edit
                .width=${this.widthDefault}
                .value=${this.column.default}
                .active=${this.active}
                placeholder="default"
              ></vuerd-input-edit>
            `);
          }
          break;
        case "columnComment":
          if (show.columnComment) {
            columns.push(html`
              <vuerd-input-edit
                .width=${this.widthComment}
                .value=${this.column.comment}
                .active=${this.active}
                placeholder="comment"
              ></vuerd-input-edit>
            `);
          }
          break;
        case "columnUnique":
          if (show.columnUnique) {
            columns.push(html`
              <vuerd-column-unique
                .columnOption=${option}
              ></vuerd-column-unique>
            `);
          }
          break;
        case "columnAutoIncrement":
          if (show.columnAutoIncrement) {
            columns.push(html`
              <vuerd-column-auto-increment
                .columnOption=${option}
              ></vuerd-column-auto-increment>
            `);
          }
          break;
      }
    });
    return html`
      <div
        class=${classMap({
          "vuerd-column": true,
          active: this.active,
        })}
      >
        <vuerd-column-key .columnUI=${ui}></vuerd-column-key>
        ${columns}
      </div>
    `;
  }
}
