import { html, customElement, property } from "lit-element";
import { unsafeHTML } from "lit-html/directives/unsafe-html";
import { Subscription } from "rxjs";
import { EditorElement } from "./EditorElement";
import { Logger } from "@src/core/Logger";
import { Bus } from "@src/core/Event";
import { Menu, createDatabaseMenus } from "@src/core/Contextmenu";
import { hljs } from "@src/core/Highlight";
import { createDDL } from "@src/core/SQL";

@customElement("vuerd-sql")
class SQL extends EditorElement {
  @property({ type: Boolean })
  contextmenu = false;

  private contextmenuX = 0;
  private contextmenuY = 0;
  private subscriptionList: Subscription[] = [];
  private menus: Menu[] = [];

  connectedCallback() {
    super.connectedCallback();
    const { store, eventBus } = this.context;
    const { mousedown$ } = this.context.windowEventObservable;
    eventBus.on(Bus.ERD.contextmenuEnd, this.onContextmenuEnd);
    this.subscriptionList.push(
      mousedown$.subscribe(this.onMousedownWindow),
      store.observe(store.canvasState, (name) => {
        if (name === "database") {
          this.requestUpdate();
        }
      })
    );
  }
  disconnectedCallback() {
    const { eventBus } = this.context;
    eventBus.off(Bus.ERD.contextmenuEnd, this.onContextmenuEnd);
    this.subscriptionList.forEach((sub) => sub.unsubscribe());
    super.disconnectedCallback();
  }

  render() {
    const sql = createDDL(this.context.store);
    const sqlHTML = hljs.highlight("sql", sql).value;
    return html`
      <div
        class="vuerd-sql vuerd-scrollbar hljs"
        contenteditable="true"
        spellcheck="false"
        @mousedown=${this.onMousedown}
        @contextmenu=${this.onContextmenu}
      >
        ${unsafeHTML(sqlHTML)}
      </div>
      ${this.contextmenu
        ? html`
            <vuerd-contextmenu
              .menus=${this.menus}
              .x=${this.contextmenuX}
              .y=${this.contextmenuY}
            ></vuerd-contextmenu>
          `
        : ""}
    `;
  }

  private onContextmenuEnd = (event: Event) => {
    this.contextmenu = false;
  };
  private onMousedownWindow = (event: MouseEvent) => {
    const el = event.target as HTMLElement;
    const root = this.getRootNode() as ShadowRoot;
    if (!el.closest(root.host.localName)) {
      this.contextmenu = false;
    }
  };

  private onContextmenu(event: MouseEvent) {
    event.preventDefault();
    const { store } = this.context;
    this.contextmenuX = event.x;
    this.contextmenuY = event.y;
    this.menus = createDatabaseMenus(store);
    this.contextmenu = true;
  }
  private onMousedown(event: MouseEvent) {
    const el = event.target as HTMLElement;
    if (!el.closest(".vuerd-contextmenu")) {
      this.contextmenu = false;
    }
  }
}
