import { html, customElement, property } from "lit-element";
import { classMap } from "lit-html/directives/class-map";
import { Subscription } from "rxjs";
import { EditorElement } from "../EditorElement";
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
    const { show } = this.context.store.canvasState;
    const { ui } = this.column;
    return html`
      <div
        class=${classMap({
          "vuerd-column": true,
          active: this.active,
        })}
      >
        <vuerd-column-key .columnUI=${ui}></vuerd-column-key>
        <vuerd-input-edit
          .width=${this.widthName}
          .value=${this.column.name}
          .active=${this.active}
          placeholder="column"
        ></vuerd-input-edit>
        ${show.columnDataType
          ? html`
              <vuerd-input-edit
                .width=${this.widthDataType}
                .value=${this.column.dataType}
                .active=${this.active}
                placeholder="dataType"
              ></vuerd-input-edit>
            `
          : ""}
        ${show.columnNotNull
          ? html`
              <vuerd-column-not-null
                .columnOption=${this.column.option}
              ></vuerd-column-not-null>
            `
          : ""}
        ${show.columnDefault
          ? html`
              <vuerd-input-edit
                .width=${this.widthDefault}
                .value=${this.column.default}
                .active=${this.active}
                placeholder="default"
              ></vuerd-input-edit>
            `
          : ""}
        ${show.columnComment
          ? html`
              <vuerd-input-edit
                .width=${this.widthComment}
                .value=${this.column.comment}
                .active=${this.active}
                placeholder="comment"
              ></vuerd-input-edit>
            `
          : ""}
      </div>
    `;
  }
}
