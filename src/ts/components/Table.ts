import { html, customElement } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { Subscription } from "rxjs";
import { EditorElement } from "./EditorElement";
import { Logger } from "@src/core/Logger";
import { moveTable, removeTable, selectTable } from "@src/core/command/table";
import { addColumn } from "@src/core/command/column";
import { Table as TableModel } from "@src/core/store/Table";
import { keymapOptionToString } from "@src/core/Keymap";
import "./CircleButton";

@customElement("vuerd-table")
class Table extends EditorElement {
  table!: TableModel;

  private subTableUI!: Subscription;
  private subTableColumns!: Subscription;
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
      zIndex: `${ui.zIndex}`
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
    this.subTableUI = store.observe(this.table.ui, () => this.requestUpdate());
    this.subTableColumns = store.observe(this.table.columns, () =>
      this.requestUpdate()
    );
  }
  firstUpdated() {
    Logger.debug("Table after render");
  }
  disconnectedCallback() {
    Logger.debug("Table destroy");
    this.onMouseup();
    this.subTableUI.unsubscribe();
    this.subTableColumns.unsubscribe();
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
          <div class="vuerd-table-header-body"></div>
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
      store.dispatch([selectTable(store, event.ctrlKey, this.table.id)]);
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
    store.dispatch([
      moveTable(store, event.ctrlKey, movementX, movementY, this.table.id)
    ]);
  };
  private onAddColumn(event: MouseEvent) {
    const { store } = this.context;
    store.dispatch([addColumn(store)]);
  }
  private onRemoveTable(event: MouseEvent) {
    const { store } = this.context;
    store.dispatch([removeTable(store)]);
  }
}
