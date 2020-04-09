import { html, customElement } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { Subscription } from "rxjs";
import { EditorElement } from "./EditorElement";
import { Logger } from "@src/core/Logger";
import { moveTable, removeTable, selectTable } from "@src/core/command/table";
import { addColumn } from "@src/core/command/column";
import { tableEditEnd } from "@src/core/command/editor";
import { Table as TableModel } from "@src/core/store/Table";
import { keymapOptionToString } from "@src/core/Keymap";
import { FocusType } from "@src/core/model/TableFocusModel";

@customElement("vuerd-table")
class Table extends EditorElement {
  table!: TableModel;

  private subscriptionList: Subscription[] = [];
  private subMouseup: Subscription | null = null;
  private subMousemove: Subscription | null = null;

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

  get focusTableName() {
    const { editorState } = this.context.store;
    return (
      editorState.tableFocus !== null &&
      editorState.tableFocus.id === this.table.id &&
      editorState.tableFocus.focusName
    );
  }

  get focusTableComment() {
    const { editorState } = this.context.store;
    return (
      editorState.tableFocus !== null &&
      editorState.tableFocus.id === this.table.id &&
      editorState.tableFocus.focusComment
    );
  }

  connectedCallback() {
    super.connectedCallback();
    Logger.debug("Table before render");
    const { store } = this.context;
    this.subscriptionList.push.apply(this.subscriptionList, [
      store.observe(this.table.ui, () => this.requestUpdate()),
      store.observe(this.table.columns, () => this.requestUpdate()),
      store.observe(store.editorState, (name: string | number | symbol) => {
        Logger.debug(`Table observe editorState: ${String(name)}`);
        if (name === "tableFocus" || name === "tableEdit") {
          if (
            store.editorState.tableFocus === null ||
            store.editorState.tableFocus.id === this.table.id
          ) {
            this.requestUpdate();
          }
        }
      }),
    ]);
  }
  firstUpdated() {
    Logger.debug("Table after render");
  }
  disconnectedCallback() {
    Logger.debug("Table destroy");
    this.onMouseup();
    this.subscriptionList.forEach(sub => sub.unsubscribe());
    super.disconnectedCallback();
  }

  render() {
    Logger.debug("Table render");
    const { theme, keymap } = this.context;
    const keymapAddColumn = keymapOptionToString(keymap.addColumn[0]);
    const keymapRemoveTable = keymapOptionToString(keymap.removeTable[0]);
    return html`
      <div
        class="vuerd-table"
        style=${styleMap(this.theme)}
        @mousedown=${this.onMousedown}
      >
        <div class="vuerd-table-header">
          <div class="vuerd-table-header-top">
            <vuerd-circle-button
              .context=${this.context}
              .backgroundColor=${theme.buttonClose}
              .color=${theme.buttonClose}
              icon="times"
              title=${keymapRemoveTable}
              @click=${this.onRemoveTable}
            ></vuerd-circle-button>
            <vuerd-circle-button
              .context=${this.context}
              .backgroundColor=${theme.buttonAdd}
              .color=${theme.buttonAdd}
              icon="plus"
              title=${keymapAddColumn}
              @click=${this.onAddColumn}
            ></vuerd-circle-button>
          </div>
          <div class="vuerd-table-header-body">
            <vuerd-input-edit
              .context=${this.context}
              .width=${this.table.ui.widthName}
              .value=${this.table.name}
              placeholder="table"
              ?focusState=${this.focusTableName}
              @input=${(event: InputEvent) =>
                this.onInputTable(event, "tableName")}
              @blur=${(event: Event) => this.onBlurTable(event, "tableName")}
            ></vuerd-input-edit>
            <vuerd-input-edit
              .context=${this.context}
              .width=${this.table.ui.widthComment}
              .value=${this.table.comment}
              placeholder="comment"
              ?focusState=${this.focusTableComment}
              @input=${(event: InputEvent) =>
                this.onInputTable(event, "tableComment")}
              @blur=${(event: Event) => this.onBlurTable(event, "tableComment")}
            ></vuerd-input-edit>
          </div>
        </div>
      </div>
    `;
  }

  private onMousedown = (event: MouseEvent) => {
    const el = event.target as HTMLElement;
    if (!el.closest(".vuerd-circle-button") && !el.closest(".vuerd-column")) {
      const { mouseup$, mousemove$ } = this.context.windowEventObservable;
      this.subMouseup = mouseup$.subscribe(this.onMouseup);
      this.subMousemove = mousemove$.subscribe(this.onMousemove);
    }
    if (
      !el.closest(".vuerd-table-name") &&
      !el.closest(".vuerd-table-comment") &&
      !el.closest(".vuerd-column")
    ) {
      const { store } = this.context;
      store.dispatch(selectTable(store, event.ctrlKey, this.table.id));
    }
  };

  private onMouseup = (event?: MouseEvent) => {
    if (this.subMouseup) {
      this.subMouseup.unsubscribe();
    }
    if (this.subMousemove) {
      this.subMousemove.unsubscribe();
    }
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
  private onAddColumn(event: MouseEvent) {
    const { store } = this.context;
    store.dispatch(addColumn(store, this.table.id));
  }
  private onRemoveTable(event: MouseEvent) {
    const { store } = this.context;
    store.dispatch(removeTable(store, this.table.id));
  }
  private onInputTable(event: InputEvent, name: FocusType) {
    Logger.debug(`onInputTable: ${name}`);
    Logger.debug(event);
  }
  private onBlurTable(event: Event, name: FocusType) {
    Logger.debug(`onBlurTable: ${name}`);
    const { store } = this.context;
    store.dispatch(tableEditEnd());
  }
}
