import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { repeat } from "lit-html/directives/repeat";
import { Subscription } from "rxjs";
import { EditorElement } from "./EditorElement";
import { Logger } from "@src/core/Logger";
import {
  moveTable,
  removeTable,
  selectTable,
  changeTableName,
  changeTableComment,
} from "@src/core/command/table";
import { addColumn } from "@src/core/command/column";
import {
  editEndTable,
  focusTargetTable,
  editTable as editTableCommand,
} from "@src/core/command/editor";
import { Table as TableModel, Column } from "@src/core/store/Table";
import { keymapOptionToString } from "@src/core/Keymap";
import { FocusType } from "@src/core/model/FocusTableModel";
import { getData } from "@src/core/Helper";

type FocusTableKey = "focusName" | "focusComment";

@customElement("vuerd-table")
class Table extends EditorElement {
  @property({ type: String })
  buttonColor = "#fff0";

  table!: TableModel;

  private subscriptionList: Subscription[] = [];
  private subMouseup: Subscription | null = null;
  private subMousemove: Subscription | null = null;
  private subFocusTable: Subscription | null = null;

  get theme() {
    const { table, tableActive } = this.context.theme;
    const { ui } = this.table;
    const theme: any = {
      backgroundColor: table,
      top: `${ui.top}px`,
      left: `${ui.left}px`,
      width: `${this.table.width()}px`,
      height: `${this.table.height()}px`,
      zIndex: `${ui.zIndex}`,
    };
    if (ui.active) {
      theme.border = `solid ${tableActive} 1px`;
      theme.boxShadow = `0 1px 6px ${tableActive}`;
    }
    return theme;
  }

  connectedCallback() {
    super.connectedCallback();
    Logger.debug("Table before render");
    const { store } = this.context;
    this.subscriptionList.push.apply(this.subscriptionList, [
      store.observe(this.table.ui, () => this.requestUpdate()),
      store.observe(this.table.columns, () => this.requestUpdate()),
      store.observe(
        store.canvasState.show,
        (name: string | number | symbol) => {
          if (name === "tableComment") {
            this.requestUpdate();
          }
        }
      ),
      store.observe(store.editorState, (name: string | number | symbol) => {
        Logger.debug(`Table observe editorState: ${String(name)}`);
        switch (name) {
          case "focusTable":
            if (
              store.editorState.focusTable === null ||
              store.editorState.focusTable.id !== this.table.id
            ) {
              this.focusTableUnsubscribe();
            } else if (
              this.subFocusTable === null &&
              store.editorState.focusTable?.id === this.table.id
            ) {
              this.focusTableObserve();
            }
            this.requestUpdate();
            break;
          case "editTable":
            if (store.editorState.focusTable?.id === this.table.id) {
              this.requestUpdate();
            }
            break;
        }
      }),
    ]);
    this.focusTableObserve();
  }
  disconnectedCallback() {
    Logger.debug("Table destroy");
    this.onMouseup();
    this.subscriptionList.forEach(sub => sub.unsubscribe());
    this.focusTableUnsubscribe();
    super.disconnectedCallback();
  }

  render() {
    Logger.debug("Table render");
    const { keymap } = this.context;
    const { show } = this.context.store.canvasState;
    const keymapAddColumn = keymapOptionToString(keymap.addColumn[0]);
    const keymapRemoveTable = keymapOptionToString(keymap.removeTable[0]);
    const widthColumn = this.table.maxWidthColumn();
    return html`
      <div
        class="vuerd-table"
        style=${styleMap(this.theme)}
        @mousedown=${this.onMousedown}
        @mouseenter=${this.onMouseenter}
        @mouseleave=${this.onMouseleave}
      >
        <div class="vuerd-table-header">
          <div class="vuerd-table-header-top">
            <vuerd-fontawesome
              class="vuerd-button"
              .context=${this.context}
              .color=${this.buttonColor}
              title=${keymapRemoveTable}
              icon="times"
              size="12"
              @click=${this.onRemoveTable}
            ></vuerd-fontawesome>
            <vuerd-fontawesome
              class="vuerd-button"
              .context=${this.context}
              .color=${this.buttonColor}
              title=${keymapAddColumn}
              icon="plus"
              size="12"
              @click=${this.onAddColumn}
            ></vuerd-fontawesome>
          </div>
          <div class="vuerd-table-header-body">
            <vuerd-input-edit
              class="vuerd-table-name"
              .context=${this.context}
              .width=${this.table.ui.widthName}
              .value=${this.table.name}
              .focusState=${this.focusTable("focusName")}
              .edit=${this.editTable("tableName")}
              placeholder="table"
              @blur=${this.onBlur}
              @input=${(event: InputEvent) => this.onInput(event, "tableName")}
              @mousedown=${(event: MouseEvent) =>
                this.onFocus(event, "tableName")}
              @dblclick=${(event: MouseEvent) =>
                this.onEdit(event, "tableName")}
            ></vuerd-input-edit>
            ${show.tableComment
              ? html`
                  <vuerd-input-edit
                    class="vuerd-table-comment"
                    .context=${this.context}
                    .width=${this.table.ui.widthComment}
                    .value=${this.table.comment}
                    .focusState=${this.focusTable("focusComment")}
                    .edit=${this.editTable("tableComment")}
                    placeholder="comment"
                    @blur=${this.onBlur}
                    @input=${(event: InputEvent) =>
                      this.onInput(event, "tableComment")}
                    @mousedown=${(event: MouseEvent) =>
                      this.onFocus(event, "tableComment")}
                    @dblclick=${(event: MouseEvent) =>
                      this.onEdit(event, "tableComment")}
                  ></vuerd-input-edit>
                `
              : html``}
          </div>
        </div>
        <ul class="vuerd-table-body">
          ${repeat(
            this.table.columns,
            column => column.id,
            column =>
              html`
                <vuerd-column
                  .context=${this.context}
                  .tableId=${this.table.id}
                  .column=${column}
                  .selected=${this.selectColumn(column)}
                  .focusName=${this.focusColumn(column, "columnName")}
                  .focusDataType=${this.focusColumn(column, "columnDataType")}
                  .focusNotNull=${this.focusColumn(column, "columnNotNull")}
                  .focusDefault=${this.focusColumn(column, "columnDefault")}
                  .focusComment=${this.focusColumn(column, "columnComment")}
                  .editName=${this.editColumn(column, "columnName")}
                  .editDataType=${this.editColumn(column, "columnDataType")}
                  .editDefault=${this.editColumn(column, "columnDefault")}
                  .editComment=${this.editColumn(column, "columnComment")}
                  .widthName=${widthColumn.name}
                  .widthDataType=${widthColumn.dataType}
                  .widthNotNull=${widthColumn.notNull}
                  .widthDefault=${widthColumn.default}
                  .widthComment=${widthColumn.comment}
                  @request-update=${() => this.requestUpdate()}
                ></vuerd-column>
              `
          )}
        </ul>
      </div>
    `;
  }

  private onMousedown = (event: MouseEvent) => {
    const el = event.target as HTMLElement;
    if (!el.closest(".vuerd-button") && !el.closest("vuerd-input-edit")) {
      const { mouseup$, mousemove$ } = this.context.windowEventObservable;
      this.subMouseup = mouseup$.subscribe(this.onMouseup);
      this.subMousemove = mousemove$.subscribe(this.onMousemove);
    }
    if (!el.closest("vuerd-input-edit")) {
      const { store } = this.context;
      store.dispatch(selectTable(store, event.ctrlKey, this.table.id));
    }
  };

  private onMouseup = (event?: MouseEvent) => {
    this.subMouseup?.unsubscribe();
    this.subMousemove?.unsubscribe();
    this.subMouseup = null;
    this.subMousemove = null;
  };

  private onMousemove = (event: MouseEvent) => {
    event.preventDefault();
    let movementX = event.movementX / window.devicePixelRatio;
    let movementY = event.movementY / window.devicePixelRatio;
    // firefox
    if (window.navigator.userAgent.toLowerCase().indexOf("firefox") !== -1) {
      movementX = event.movementX;
      movementY = event.movementY;
    }
    const { store } = this.context;
    store.dispatch(
      moveTable(store, event.ctrlKey, movementX, movementY, this.table.id)
    );
  };
  private onMouseenter = (event: MouseEvent) => {
    const { font } = this.context.theme;
    this.buttonColor = font;
  };
  private onMouseleave = (event: MouseEvent) => {
    this.buttonColor = "#fff0";
  };
  private onAddColumn = (event: MouseEvent) => {
    const { store } = this.context;
    store.dispatch(addColumn(store, this.table.id));
  };
  private onRemoveTable = (event: MouseEvent) => {
    const { store } = this.context;
    store.dispatch(removeTable(store, this.table.id));
  };
  private onInput(event: InputEvent, focusType: FocusType) {
    Logger.debug(`Table onInput: ${focusType}`);
    const { store, helper } = this.context;
    const input = event.target as HTMLInputElement;
    switch (focusType) {
      case "tableName":
        store.dispatch(changeTableName(helper, this.table.id, input.value));
        break;
      case "tableComment":
        store.dispatch(changeTableComment(helper, this.table.id, input.value));
        break;
    }
  }
  private onBlur = (event: Event) => {
    const { store } = this.context;
    store.dispatch(editEndTable());
  };
  private onFocus(event: MouseEvent | TouchEvent, focusType: FocusType) {
    Logger.debug(`Table onFocus: ${focusType}`);
    const { store } = this.context;
    const { editTable, focusTable } = store.editorState;
    if (
      editTable === null ||
      editTable.focusType !== focusType ||
      focusTable === null ||
      focusTable.id !== this.table.id
    ) {
      store.dispatch(
        selectTable(store, event.ctrlKey, this.table.id),
        focusTargetTable(focusType)
      );
    }
  }
  private onEdit(event: MouseEvent, focusType: FocusType) {
    const { store } = this.context;
    const { editTable, focusTable } = store.editorState;
    if (focusTable !== null && editTable === null) {
      store.dispatch(editTableCommand(this.table.id, focusType));
    }
  }
  private focusTableObserve() {
    const { store } = this.context;
    if (store.editorState.focusTable?.id === this.table.id) {
      this.subFocusTable = store.observe(store.editorState.focusTable, () =>
        this.requestUpdate()
      );
    }
  }
  private focusTableUnsubscribe() {
    this.subFocusTable?.unsubscribe();
    this.subFocusTable = null;
  }
  private focusTable(focusTableKey: FocusTableKey) {
    const { editorState } = this.context.store;
    return (
      editorState.focusTable?.id === this.table.id &&
      editorState.focusTable[focusTableKey]
    );
  }
  private editTable(focusType: FocusType) {
    const { editorState } = this.context.store;
    return (
      editorState.editTable?.id === this.table.id &&
      editorState.editTable.focusType === focusType
    );
  }
  private focusColumn(column: Column, focusType: FocusType) {
    const { editorState } = this.context.store;
    return (
      editorState.focusTable?.id === this.table.id &&
      editorState.focusTable.currentFocusId === column.id &&
      editorState.focusTable.currentFocus === focusType
    );
  }
  private selectColumn(column: Column) {
    const { editorState } = this.context.store;
    return (
      editorState.focusTable?.id === this.table.id &&
      getData(editorState.focusTable.focusColumns, column.id)?.selected === true
    );
  }
  private editColumn(column: Column, focusType: FocusType) {
    const { editorState } = this.context.store;
    return (
      editorState.editTable?.id === column.id &&
      editorState.editTable.focusType === focusType
    );
  }
}
