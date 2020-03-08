import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { repeat } from "lit-html/directives/repeat";
import { EditorElement } from "./EditorElement";
import { SIZE_MENU_HEIGHT } from "@src/core/Layout";
import { Menu } from "@src/core/model/Menu";
import { Bus } from "@src/core/Event";

@customElement("vuerd-contextmenu")
export class Contextmenu extends EditorElement {
  @property({ type: Number })
  x = 0;
  @property({ type: Number })
  y = 0;
  @property({ type: Object })
  currentMenu: Menu | null = null;

  menus: Menu[] = [];

  get theme() {
    const { table, font } = this.context.theme;
    return {
      backgroundColor: table,
      color: font,
      left: `${this.x}px`,
      top: `${this.y}px`
    };
  }

  get childrenX() {
    let x = this.x;
    const ul = this.renderRoot.querySelector(".vuerd-contextmenu-ul");
    if (ul) {
      x = this.x + ul.clientWidth;
    }
    return x;
  }

  get childrenY() {
    let y = this.y;
    if (this.currentMenu) {
      y += this.menus.indexOf(this.currentMenu) * SIZE_MENU_HEIGHT;
    }
    return y;
  }

  constructor() {
    super();
    console.log("Contextmenu constructor");
  }
  connectedCallback() {
    super.connectedCallback();
    console.log("Contextmenu before render");
  }
  firstUpdated() {
    console.log("Contextmenu after render");
  }
  disconnectedCallback() {
    console.log("Contextmenu destroy");
    this.currentMenu = null;
    super.disconnectedCallback();
  }

  render() {
    console.log("Contextmenu render");
    return html`
      <div class="vuerd-contextmenu">
        <ul class="vuerd-contextmenu-ul" style=${styleMap(this.theme)}>
          ${repeat(
            this.menus,
            menu => menu.id,
            menu => html`
              <li
                @click=${() => this.onExecute(menu)}
                @mouseover=${() => this.onMouseover(menu)}
                @mouseenter=${this.onMouseenter}
                @mouseleave=${this.onMouseleave}
              >
                ${menu.icon
                  ? html`
                      <span class="icon">
                        <vuerd-fontawesome
                          .context=${this.context}
                          size="14"
                          icon=${menu.icon}
                        >
                        </vuerd-fontawesome>
                      </span>
                    `
                  : html`
                      <span class="icon"></span>
                    `}
                <span class="name">${menu.name}</span>
                <span class="keymap">${menu.keymap}</span>
              </li>
            `
          )}
        </ul>
        ${this.currentMenu && this.currentMenu.children
          ? html`
              <vuerd-contextmenu
                .context=${this.context}
                .menus=${this.currentMenu.children}
                .x=${this.childrenX}
                .y=${this.childrenY}
              ></vuerd-contextmenu>
            `
          : ``}
      </div>
    `;
  }

  private onMouseover(menu: Menu) {
    this.currentMenu = menu;
  }
  private onMouseenter = (event: MouseEvent) => {
    const { fontActive, contextmenuActive } = this.context.theme;
    const el = event.target as HTMLElement;
    el.style.color = fontActive;
    el.style.backgroundColor = contextmenuActive;
  };
  private onMouseleave = (event: MouseEvent) => {
    const el = event.target as HTMLElement;
    el.style.color = "";
    el.style.backgroundColor = "";
  };
  private onExecute(menu: Menu) {
    if (!menu.children && menu.execute && typeof menu.execute === "function") {
      menu.execute();
      if (
        !menu.option ||
        menu.option.close ||
        menu.option.close === undefined
      ) {
        this.context.eventBus.emit(Bus.ERD.contextmenuEnd);
      }
    }
  }
}
