import { html, customElement, property } from "lit-element";
import { unsafeHTML } from "lit-html/directives/unsafe-html";
import { EditorElement } from "@src/components/EditorElement";
import { Logger } from "@src/core/Logger";
import { Bus } from "@src/core/Event";
import { Menu, createDatabaseMenus } from "@src/core/Contextmenu";
import { Table } from "@src/core/store/Table";
import { hljs } from "@src/core/Highlight";
import { createDDLTable } from "@src/core/SQL";

@customElement("vuerd-tab-sql")
class TabSQL extends EditorElement {
  @property({ type: Boolean })
  contextmenu = false;

  table!: Table;

  private contextmenuX = 0;
  private contextmenuY = 0;
  private menus: Menu[] = [];

  connectedCallback() {
    super.connectedCallback();
    const { store, eventBus } = this.context;
    this.subscriptionList.push(
      eventBus.on(Bus.ERD.contextmenuEnd).subscribe(this.onContextmenuEnd),
      store.observe(store.canvasState, (name) => {
        if (name === "database") {
          this.requestUpdate();
        }
      })
    );
  }

  render() {
    const sql = createDDLTable(this.context.store, this.table);
    const sqlHTML = hljs.highlight("sql", sql).value;
    return html`
      <div
        class="vuerd-tab-sql vuerd-scrollbar hljs"
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
