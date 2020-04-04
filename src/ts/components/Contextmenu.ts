import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { EditorElement } from "./EditorElement";
import { Logger } from "@src/core/Logger";
import { SIZE_MENU_HEIGHT } from "@src/core/Layout";
import { Menu } from "@src/core/Contextmenu";
import { Bus } from "@src/core/Event";

@customElement("vuerd-contextmenu")
export class Contextmenu extends EditorElement {
  @property({ type: Number })
  x = 0;
  @property({ type: Number })
  y = 0;
  @property({ attribute: false })
  currentMenu: Menu | null = null;

  menus: Menu[] = [];

  get theme() {
    const { table, font } = this.context.theme;
    return {
      backgroundColor: table,
      color: font,
      left: `${this.x}px`,
      top: `${this.y}px`,
    };
  }

  get childrenX() {
    let x = this.x;
    const ul = this.renderRoot.querySelector(".vuerd-contextmenu");
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

  connectedCallback() {
    super.connectedCallback();
    Logger.debug("Contextmenu before render");
  }
  firstUpdated() {
    Logger.debug("Contextmenu after render");
  }
  disconnectedCallback() {
    Logger.debug("Contextmenu destroy");
    this.currentMenu = null;
    super.disconnectedCallback();
  }

  render() {
    Logger.debug("Contextmenu render");
    return html`
      <ul class="vuerd-contextmenu" style=${styleMap(this.theme)}>
        ${this.menus.map(
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
              <span class="keymap" title=${menu.keymap ? menu.keymap : ""}>
                ${menu.keymap}
              </span>
              ${menu.children
                ? html`
                    <span class="arrow">
                      <vuerd-fontawesome
                        .context=${this.context}
                        size="13"
                        icon="chevron-right"
                      >
                      </vuerd-fontawesome>
                    </span>
                  `
                : html``}
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
