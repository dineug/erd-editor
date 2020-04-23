import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { classMap } from "lit-html/directives/class-map";
import { repeat } from "lit-html/directives/repeat";
import { Subscription, Subject, fromEvent } from "rxjs";
import { debounceTime, throttleTime } from "rxjs/operators";
import { EditorElement } from "./EditorElement";
import { Logger } from "@src/core/Logger";
import { Table as TableModel, Column } from "@src/core/store/Table";
import { keymapOptionToString } from "@src/core/Keymap";
import { FocusType } from "@src/core/model/FocusTableModel";
import { getData } from "@src/core/Helper";
import { FlipAnimation } from "@src/core/Animation";
import {
  moveTable,
  removeTable,
  selectTable,
  changeTableName,
  changeTableComment,
} from "@src/core/command/table";
import { addColumn, moveColumn } from "@src/core/command/column";
import {
  editEndTable,
  focusTargetTable,
  editTable as editTableCommand,
} from "@src/core/command/editor";

type FocusTableKey = "focusName" | "focusComment";

@customElement("vuerd-table")
class Table extends EditorElement {
  table!: TableModel;

  private draggable$: Subject<CustomEvent> = new Subject();
  private subscriptionList: Subscription[] = [];
  private subMouseup: Subscription | null = null;
  private subMousemove: Subscription | null = null;
  private subFocusTable: Subscription | null = null;
  private subDraggableColumns: Subscription[] = [];
  private flipAnimation = new FlipAnimation(
    this.renderRoot,
    ".vuerd-column",
    "vuerd-column-move"
  );

  connectedCallback() {
    super.connectedCallback();
    Logger.debug("Table before render");
    const { store } = this.context;
    this.subscriptionList.push.apply(this.subscriptionList, [
      this.draggable$.pipe(debounceTime(50)).subscribe(this.onDragoverColumn),
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
      }),
      store.observe(store.editorState, (name: string | number | symbol) => {
        Logger.debug(`Table observe editorState: ${String(name)}`);
        const { focusTable, draggableColumn } = store.editorState;
        switch (name) {
          case "focusTable":
            if (focusTable === null || focusTable.id !== this.table.id) {
              this.focusTableUnsubscribe();
            } else if (
              this.subFocusTable === null &&
              focusTable?.id === this.table.id
            ) {
              this.focusTableObserve();
            }
            this.requestUpdate();
            break;
          case "editTable":
            if (focusTable?.id === this.table.id) {
              this.requestUpdate();
            }
            break;
          case "draggableColumn":
            if (draggableColumn) {
              if (this.subDraggableColumns.length === 0) {
                this.onDraggableColumn();
              }
            } else {
              this.onDraggableEndColumn();
              this.requestUpdate();
            }
            break;
        }
      }),
    ]);
    this.focusTableObserve();
  }
  updated(changedProperties: any) {
    this.flipAnimation.play();
  }
  disconnectedCallback() {
    Logger.debug("Table destroy");
    this.onMouseup();
    this.focusTableUnsubscribe();
    this.subscriptionList.forEach((sub) => sub.unsubscribe());
    super.disconnectedCallback();
  }

  render() {
    Logger.debug("Table render");
    const { ui } = this.table;
    const { keymap } = this.context;
    const { show } = this.context.store.canvasState;
    const keymapAddColumn = keymapOptionToString(keymap.addColumn[0]);
    const keymapRemoveTable = keymapOptionToString(keymap.removeTable[0]);
    const widthColumn = this.table.maxWidthColumn();
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
        @mousedown=${this.onMousedown}
      >
        <div class="vuerd-table-header">
          <div class="vuerd-table-header-top">
            <vuerd-icon
              class="vuerd-button"
              title=${keymapRemoveTable}
              icon="times"
              size="12"
              @click=${this.onRemoveTable}
            ></vuerd-icon>
            <vuerd-icon
              class="vuerd-button"
              title=${keymapAddColumn}
              icon="plus"
              size="12"
              @click=${this.onAddColumn}
            ></vuerd-icon>
          </div>
          <div class="vuerd-table-header-body">
            <vuerd-input-edit
              class="vuerd-table-name"
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
              : ""}
          </div>
        </div>
        <div class="vuerd-table-body">
          ${repeat(
            this.table.columns,
            (column) => column.id,
            (column) =>
              html`
                <vuerd-column
                  .tableId=${this.table.id}
                  .column=${column}
                  .select=${this.selectColumn(column)}
                  .draggable=${this.draggableColumn(column)}
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
        </div>
      </div>
    `;
  }

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
  private onDragoverGroupColumn = (event: CustomEvent) => {
    Logger.debug("Table onDragoverGroupColumn");
    this.draggable$.next(event);
  };
  private onDragoverColumn = (event: CustomEvent) => {
    Logger.debug("Table onDragoverColumn");
    const { store } = this.context;
    const { draggableColumn } = store.editorState;
    const { tableId, columnId } = event.detail;
    if (
      draggableColumn &&
      !draggableColumn.columnIds.some((id) => id === columnId)
    ) {
      this.flipAnimation.snapshot();
      store.dispatch(
        moveColumn(
          draggableColumn.tableId,
          draggableColumn.columnIds,
          tableId,
          columnId
        )
      );
    }
  };

  private onMousedown(event: MouseEvent) {
    const el = event.target as HTMLElement;
    if (!el.closest(".vuerd-button") && !el.closest("vuerd-input-edit")) {
      const { mouseup$, mousemove$ } = this.context.windowEventObservable;
      this.onMouseup();
      this.subMouseup = mouseup$.subscribe(this.onMouseup);
      this.subMousemove = mousemove$.subscribe(this.onMousemove);
    }
    if (!el.closest("vuerd-input-edit")) {
      const { store } = this.context;
      store.dispatch(selectTable(store, event.ctrlKey, this.table.id));
    }
  }
  private onDraggableColumn() {
    Logger.debug("Table onDraggableColumn");
    const liNodeList = this.renderRoot.querySelectorAll("vuerd-column");
    liNodeList.forEach((li) => {
      this.subDraggableColumns.push(
        fromEvent<CustomEvent>(li, "dragover")
          .pipe(throttleTime(300))
          .subscribe(this.onDragoverGroupColumn)
      );
    });
  }
  private onDraggableEndColumn() {
    Logger.debug("Table onDraggableEndColumn");
    this.subDraggableColumns.forEach((sub) => sub.unsubscribe());
    this.subDraggableColumns = [];
  }
  private onAddColumn(event: MouseEvent) {
    const { store } = this.context;
    store.dispatch(addColumn(store, this.table.id));
  }
  private onRemoveTable(event: MouseEvent) {
    const { store } = this.context;
    store.dispatch(removeTable(store, this.table.id));
  }
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
  private onBlur(event: Event) {
    const { store } = this.context;
    store.dispatch(editEndTable());
  }
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
    const { focusTable } = this.context.store.editorState;
    return focusTable?.id === this.table.id && focusTable[focusTableKey];
  }
  private editTable(focusType: FocusType) {
    const { editTable } = this.context.store.editorState;
    return editTable?.id === this.table.id && editTable.focusType === focusType;
  }
  private focusColumn(column: Column, focusType: FocusType) {
    const { focusTable } = this.context.store.editorState;
    return (
      focusTable?.id === this.table.id &&
      focusTable.currentFocusId === column.id &&
      focusTable.currentFocus === focusType
    );
  }
  private selectColumn(column: Column) {
    const { focusTable } = this.context.store.editorState;
    return (
      focusTable?.id === this.table.id &&
      getData(focusTable.focusColumns, column.id)?.select === true
    );
  }
  private editColumn(column: Column, focusType: FocusType) {
    const { editTable } = this.context.store.editorState;
    return editTable?.id === column.id && editTable.focusType === focusType;
  }
  private draggableColumn(column: Column) {
    const { draggableColumn } = this.context.store.editorState;
    return (
      draggableColumn?.tableId === this.table.id &&
      draggableColumn.columnIds.some((id) => id === column.id)
    );
  }
}
