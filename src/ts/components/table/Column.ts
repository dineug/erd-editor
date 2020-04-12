import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { Subscription } from "rxjs";
import { EditorElement } from "../EditorElement";
import { Logger } from "@src/core/Logger";
import { Column as ColumnModel } from "@src/core/store/Table";
import { editEndTable } from "@src/core/command/editor";
import { FocusType } from "@src/core/model/FocusTableModel";

@customElement("vuerd-column")
class Column extends EditorElement {
  @property({ type: Boolean })
  selected = false;
  @property({ type: Boolean })
  focusName = false;
  @property({ type: Boolean })
  focusDataType = false;
  @property({ type: Boolean })
  focusNotNull = false;
  @property({ type: Boolean })
  focusDefault = false;
  @property({ type: Boolean })
  focusComment = false;
  @property({ type: Boolean })
  editName = false;
  @property({ type: Boolean })
  editDataType = false;
  @property({ type: Boolean })
  editDefault = false;
  @property({ type: Boolean })
  editComment = false;

  tableId!: string;
  column!: ColumnModel;

  private subscriptionList: Subscription[] = [];

  get theme() {
    const { columnSelected } = this.context.theme;
    const theme: any = {};
    if (this.selected) {
      theme.backgroundColor = columnSelected;
    }
    return theme;
  }

  connectedCallback() {
    super.connectedCallback();
    const { store } = this.context;
    this.subscriptionList.push.apply(this.subscriptionList, [
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
      ),
    ]);
  }
  disconnectedCallback() {
    this.subscriptionList.forEach(sub => sub.unsubscribe());
    super.disconnectedCallback();
  }

  render() {
    const { show } = this.context.store.canvasState;
    const { columnSelected } = this.context.theme;
    return html`
      <li
        class="vuerd-column"
        style=${styleMap(this.theme)}
        data-id=${this.column.id}
        draggable="true"
      >
        <vuerd-column-key
          .context=${this.context}
          .columnUI=${this.column.ui}
        ></vuerd-column-key>
        <vuerd-input-edit
          .context=${this.context}
          .width=${this.column.ui.widthName}
          .value=${this.column.name}
          .focusState=${this.focusName}
          .edit=${this.editName}
          .backgroundColor=${columnSelected}
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
                .focusState=${this.focusDataType}
                .edit=${this.editDataType}
                .backgroundColor=${columnSelected}
                placeholder="dataType"
              ></vuerd-input-edit>
            `
          : html``}
        ${show.columnNotNull
          ? html`
              <vuerd-column-not-null
                .context=${this.context}
                .columnOption=${this.column.option}
                .focusState=${this.focusNotNull}
              ></vuerd-column-not-null>
            `
          : html``}
        ${show.columnDefault
          ? html`
              <vuerd-input-edit
                .context=${this.context}
                .width=${this.column.ui.widthDefault}
                .value=${this.column.default}
                .focusState=${this.focusDefault}
                .edit=${this.editDefault}
                .backgroundColor=${columnSelected}
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
                .focusState=${this.focusComment}
                .edit=${this.editComment}
                .backgroundColor=${columnSelected}
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
    store.dispatch(editEndTable());
  };
}
