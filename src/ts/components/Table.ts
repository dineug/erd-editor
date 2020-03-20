import { html, customElement } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { Subscription } from "rxjs";
import { EditorElement } from "./EditorElement";
import { Logger } from "@src/core/Logger";
import { tableMove } from "@src/core/command/table";
import { Table as TableModel } from "@src/core/store/Table";

@customElement("vuerd-table")
class Table extends EditorElement {
  table!: TableModel;

  private subTableUI!: Subscription;
  private subMouseup: Subscription | null = null;
  private subMousemove: Subscription | null = null;

  get theme() {
    const { table } = this.context.theme;
    const { ui } = this.table;
    return {
      backgroundColor: table,
      top: `${ui.top}px`,
      left: `${ui.left}px`,
      width: `${this.table.width()}px`,
      height: `${this.table.height()}px`,
      zIndex: `${ui.zIndex}`
    };
  }

  connectedCallback() {
    super.connectedCallback();
    Logger.debug("Table before render");
    const { store } = this.context;
    this.subTableUI = store.observe(this.table.ui, () => this.requestUpdate());
  }
  firstUpdated() {
    Logger.debug("Table after render");
  }
  disconnectedCallback() {
    Logger.debug("Table destroy");
    this.onMouseup();
    this.subTableUI.unsubscribe();
    super.disconnectedCallback();
  }

  render() {
    Logger.debug("Table render");
    return html`
      <div
        class="vuerd-table"
        style=${styleMap(this.theme)}
        @mousedown=${this.onMousedown}
      ></div>
    `;
  }

  private onMousedown = (event: MouseEvent) => {
    const { mouseup$, mousemove$ } = this.context.windowEventObservable;
    this.subMouseup = mouseup$.subscribe(this.onMouseup);
    this.subMousemove = mousemove$.subscribe(this.onMousemove);
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
      tableMove(store, event.ctrlKey, movementX, movementY, this.table.id)
    );
  };
}
