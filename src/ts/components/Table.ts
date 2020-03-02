import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { EditorElement } from "../model/EditorElement";
import { Subscription } from "rxjs";

@customElement("vuerd-table")
class Table extends EditorElement {
  @property({ type: Object })
  table = {
    width: 100,
    height: 100,
    ui: {
      top: 10,
      left: 10,
      zIndex: 2
    }
  };

  private subMouseup: Subscription | null = null;
  private subMousemove: Subscription | null = null;

  get theme() {
    const { table } = this.context.theme;
    return {
      backgroundColor: table,
      top: `${this.table.ui.top}px`,
      left: `${this.table.ui.left}px`,
      width: `${this.table.width}px`,
      height: `${this.table.height}px`,
      zIndex: `${this.table.ui.zIndex}`
    };
  }

  constructor() {
    super();
    console.log("Table constructor");
  }
  connectedCallback() {
    super.connectedCallback();
    console.log("Table before render");
  }
  firstUpdated() {
    console.log("Table after render");
  }
  disconnectedCallback() {
    console.log("Table destroy");
    super.disconnectedCallback();
  }

  private onMousedown() {
    const { mouseup$, mousemove$ } = this.context.windowEventObservable;
    this.subMouseup = mouseup$.subscribe(event => this.onMouseup(event));
    this.subMousemove = mousemove$.subscribe(event => this.onMousemove(event));
  }

  private onMouseup(event: MouseEvent) {
    if (this.subMouseup) {
      this.subMouseup.unsubscribe();
    }
    if (this.subMousemove) {
      this.subMousemove.unsubscribe();
    }
    this.subMouseup = null;
    this.subMousemove = null;
  }

  private onMousemove(event: MouseEvent) {
    event.preventDefault();
    let movementX = event.movementX / window.devicePixelRatio;
    let movementY = event.movementY / window.devicePixelRatio;
    // firefox
    if (window.navigator.userAgent.toLowerCase().indexOf("firefox") !== -1) {
      movementX = event.movementX;
      movementY = event.movementY;
    }
    this.table.ui.left += movementX;
    this.table.ui.top += movementY;
    this.requestUpdate();
  }

  render() {
    console.log("Table render");
    return html`
      <div
        class="vuerd-table"
        style=${styleMap(this.theme)}
        @mousedown=${this.onMousedown}
      ></div>
    `;
  }
}
