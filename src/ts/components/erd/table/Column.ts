import { html, customElement, property, TemplateResult } from "lit-element";
import { classMap } from "lit-html/directives/class-map";
import { EditorElement } from "@src/components/EditorElement";
import { Logger } from "@src/core/Logger";
import { SIZE_MIN_WIDTH } from "@src/core/Layout";
import { Column as ColumnModel } from "@src/core/store/Table";
import { selectTable } from "@src/core/command/table";
import {
  editTableEnd,
  focusTargetColumn,
  editTable as editTableCommand,
  draggableColumn,
  draggableColumnEnd,
} from "@src/core/command/editor";
import {
  changeColumnNotNull,
  removeColumn,
  changeColumnName,
  changeColumnComment,
  changeColumnDataType,
  changeColumnDefault,
} from "@src/core/command/column";
import { FocusType } from "@src/core/model/FocusTableModel";
import { keymapOptionToString } from "@src/core/Keymap";

@customElement("vuerd-column")
class Column extends EditorElement {
  @property({ type: Boolean })
  select = false;
  @property({ type: Boolean })
  draggable = false;
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

  tableId!: string;
  column!: ColumnModel;

  connectedCallback() {
    super.connectedCallback();
    const { store } = this.context;
    const { columnOrder } = store.canvasState.setting;
    this.subscriptionList.push(
      store.observe(columnOrder, () => this.requestUpdate()),
      store.observe(this.column, () => this.requestUpdate()),
      store.observe(this.column.ui, (name) => {
        switch (name) {
          case "widthName":
          case "widthComment":
          case "widthDataType":
          case "widthDefault":
            this.dispatchEvent(new CustomEvent("request-update"));
            break;
          case "active":
            this.requestUpdate();
            break;
        }
      })
    );
  }

  render() {
    const { keymap } = this.context;
    const { show, setting } = this.context.store.canvasState;
    const { ui } = this.column;
    const keymapRemoveColumn = keymapOptionToString(keymap.removeColumn[0]);
    const columns: TemplateResult[] = [];
    setting.columnOrder.forEach((columnType) => {
      switch (columnType) {
        case "columnName":
          columns.push(html`
            <vuerd-input-edit
              .width=${this.widthName}
              .value=${this.column.name}
              .focusState=${this.focusName}
              .edit=${this.editName}
              .select=${this.select}
              .active=${ui.active}
              placeholder="column"
              @blur=${this.onBlur}
              @input=${(event: InputEvent) => this.onInput(event, "columnName")}
              @mousedown=${(event: MouseEvent) =>
                this.onFocus(event, "columnName")}
              @dblclick=${(event: MouseEvent) =>
                this.onEdit(event, "columnName")}
            ></vuerd-input-edit>
          `);
          break;
        case "columnDataType":
          if (show.columnDataType) {
            columns.push(html`
              <vuerd-column-data-type
                .width=${this.widthDataType}
                .value=${this.column.dataType}
                .focusState=${this.focusDataType}
                .edit=${this.editDataType}
                .select=${this.select}
                .active=${ui.active}
                .tableId=${this.tableId}
                .columnId=${this.column.id}
                @blur=${this.onBlur}
                @input=${(event: InputEvent) =>
                  this.onInput(event, "columnDataType")}
                @mousedown=${(event: MouseEvent) =>
                  this.onFocus(event, "columnDataType")}
                @dblclick=${(event: MouseEvent) =>
                  this.onEdit(event, "columnDataType")}
              ></vuerd-column-data-type>
            `);
          }
          break;
        case "columnNotNull":
          if (show.columnNotNull) {
            columns.push(html`
              <vuerd-column-not-null
                .columnOption=${this.column.option}
                .focusState=${this.focusNotNull}
                @mousedown=${(event: MouseEvent) =>
                  this.onFocus(event, "columnNotNull")}
                @dblclick=${(event: MouseEvent) =>
                  this.onEdit(event, "columnNotNull")}
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
                .focusState=${this.focusDefault}
                .edit=${this.editDefault}
                .select=${this.select}
                .active=${ui.active}
                placeholder="default"
                @blur=${this.onBlur}
                @input=${(event: InputEvent) =>
                  this.onInput(event, "columnDefault")}
                @mousedown=${(event: MouseEvent) =>
                  this.onFocus(event, "columnDefault")}
                @dblclick=${(event: MouseEvent) =>
                  this.onEdit(event, "columnDefault")}
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
                .focusState=${this.focusComment}
                .edit=${this.editComment}
                .select=${this.select}
                .active=${ui.active}
                placeholder="comment"
                @blur=${this.onBlur}
                @input=${(event: InputEvent) =>
                  this.onInput(event, "columnComment")}
                @mousedown=${(event: MouseEvent) =>
                  this.onFocus(event, "columnComment")}
                @dblclick=${(event: MouseEvent) =>
                  this.onEdit(event, "columnComment")}
              ></vuerd-input-edit>
            `);
          }
          break;
      }
    });
    return html`
      <div
        class=${classMap({
          "vuerd-column": true,
          select: this.select,
          draggable: this.draggable,
          active: ui.active,
        })}
        data-id=${this.column.id}
        draggable="true"
        @dragstart=${this.onDragstart}
        @dragend=${this.onDragend}
        @dragover=${this.onDragover}
      >
        <vuerd-column-key .columnUI=${ui}></vuerd-column-key>
        ${columns}
        <vuerd-icon
          class="vuerd-button"
          title=${keymapRemoveColumn}
          icon="times"
          size="9"
          @click=${this.onRemoveColumn}
        ></vuerd-icon>
      </div>
    `;
  }

  private onInput(event: InputEvent, focusType: FocusType) {
    const { store, helper } = this.context;
    const input = event.target as HTMLInputElement;
    switch (focusType) {
      case "columnName":
        store.dispatch(
          changeColumnName(helper, this.tableId, this.column.id, input.value)
        );
        break;
      case "columnComment":
        store.dispatch(
          changeColumnComment(helper, this.tableId, this.column.id, input.value)
        );
        break;
      case "columnDataType":
        store.dispatch(
          changeColumnDataType(
            helper,
            this.tableId,
            this.column.id,
            input.value
          )
        );
        break;
      case "columnDefault":
        store.dispatch(
          changeColumnDefault(helper, this.tableId, this.column.id, input.value)
        );
        break;
    }
  }
  private onBlur(event: Event) {
    const { store } = this.context;
    store.dispatch(editTableEnd());
  }
  private onFocus(event: MouseEvent | TouchEvent, focusType: FocusType) {
    const { store } = this.context;
    const { editTable, focusTable } = store.editorState;
    if (
      editTable === null ||
      editTable.focusType !== focusType ||
      focusTable === null ||
      focusTable.currentFocusId !== this.column.id
    ) {
      store.dispatch(
        selectTable(store, event.ctrlKey, this.tableId),
        focusTargetColumn(
          this.column.id,
          focusType,
          event.ctrlKey,
          event.shiftKey
        )
      );
    }
  }
  private onEdit(event: MouseEvent, focusType: FocusType) {
    const { store } = this.context;
    const { editTable, focusTable } = store.editorState;
    if (focusTable !== null && editTable === null) {
      if (focusType === "columnNotNull") {
        store.dispatch(
          changeColumnNotNull(store, this.tableId, this.column.id)
        );
      } else {
        store.dispatch(editTableCommand(this.column.id, focusType));
      }
    }
  }
  private onRemoveColumn(event: MouseEvent) {
    const { store } = this.context;
    store.dispatch(removeColumn(this.tableId, [this.column.id]));
  }
  private onDragstart(event: DragEvent) {
    const { store } = this.context;
    store.dispatch(
      draggableColumn(store, this.tableId, this.column.id, event.ctrlKey)
    );
  }
  private onDragend(event: DragEvent) {
    const { store } = this.context;
    store.dispatch(draggableColumnEnd());
  }
  private onDragover(event: DragEvent) {
    this.dispatchEvent(
      new CustomEvent("dragover", {
        detail: {
          tableId: this.tableId,
          columnId: this.column.id,
        },
      })
    );
  }
}
