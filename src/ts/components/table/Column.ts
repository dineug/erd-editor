import { html, customElement } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { Subscription } from "rxjs";
import { EditorElement } from "../EditorElement";
import { Logger } from "@src/core/Logger";
import { Column as ColumnModel } from "@src/core/store/Table";
import { editTableEnd } from "@src/core/command/editor";
import { FocusType } from "@src/core/model/FocusTableModel";

@customElement("vuerd-column")
class Column extends EditorElement {
  column!: ColumnModel;

  private subscriptionList: Subscription[] = [];

  connectedCallback() {
    super.connectedCallback();
    const { store } = this.context;
    this.subscriptionList.push(
      store.observe(
        store.canvasState.show,
        (name: string | number | symbol) => {
          if (
            name === "columnComment" ||
            name === "columnDataType" ||
            name === "columnDefault" ||
            name === "columnNotNull"
          ) {
            this.requestUpdate();
          }
        }
      )
    );
  }
  disconnectedCallback() {
    this.subscriptionList.forEach(sub => sub.unsubscribe());
    super.disconnectedCallback();
  }

  render() {
    const { show } = this.context.store.canvasState;
    return html`
      <li class="vuerd-column" data-id=${this.column.id} draggable="true">
        <vuerd-column-key
          .context=${this.context}
          .columnUI=${this.column.ui}
        ></vuerd-column-key>
        <vuerd-input-edit
          .context=${this.context}
          .width=${this.column.ui.widthName}
          .value=${this.column.name}
          placeholder="column"
          @input=${(event: InputEvent) => this.onInput(event, "columnName")}
          @blur=${this.onBlur}
        ></vuerd-input-edit>
        ${show.columnDataType
          ? html`
              <vuerd-input-edit
                .context=${this.context}
                .width=${this.column.ui.widthDataType}
                .value=${this.column.dataType}
                placeholder="dataType"
              ></vuerd-input-edit>
            `
          : html``}
        ${show.columnNotNull
          ? html`
              <vuerd-column-not-null
                .context=${this.context}
                .columnOption=${this.column.option}
              ></vuerd-column-not-null>
            `
          : html``}
        ${show.columnDefault
          ? html`
              <vuerd-input-edit
                .context=${this.context}
                .width=${this.column.ui.widthDefault}
                .value=${this.column.default}
                placeholder="default"
                @input=${(event: InputEvent) =>
                  this.onInput(event, "columnDefault")}
                @blur=${this.onBlur}
              ></vuerd-input-edit>
            `
          : html``}
        ${show.columnComment
          ? html`
              <vuerd-input-edit
                .context=${this.context}
                .width=${this.column.ui.widthComment}
                .value=${this.column.comment}
                placeholder="comment"
                @input=${(event: InputEvent) =>
                  this.onInput(event, "columnComment")}
                @blur=${this.onBlur}
              ></vuerd-input-edit>
            `
          : html``}
      </li>
    `;
  }
  private onInput(event: InputEvent, name: FocusType) {
    Logger.debug(`onInput: ${name}`);
    Logger.debug(event);
  }
  private onBlur = (event: Event) => {
    const { store } = this.context;
    store.dispatch(editTableEnd());
  };
}
