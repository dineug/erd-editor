import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { Subscription } from "rxjs";
import { EditorElement } from "./EditorElement";
import { Logger } from "@src/core/Logger";
import { SIZE_CONTEXTMENU_HEIGHT } from "@src/core/Layout";
import { Menu } from "@src/core/Contextmenu";
import { Bus } from "@src/core/Event";
import { Relationship } from "@src/core/store/Relationship";

@customElement("vuerd-contextmenu")
export class Contextmenu extends EditorElement {
  @property({ type: Number })
  x = 0;
  @property({ type: Number })
  y = 0;
  @property({ attribute: false })
  currentMenu: Menu | null = null;

  menus: Menu[] = [];
  relationship: Relationship | null = null;

  private subscriptionList: Subscription[] = [];

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
      y += this.menus.indexOf(this.currentMenu) * SIZE_CONTEXTMENU_HEIGHT;
    }
    return y;
  }

  connectedCallback() {
    super.connectedCallback();
    const { store } = this.context;
    this.subscriptionList.push(
      store.observe(store.canvasState.show, () => this.requestUpdate()),
      store.observe(store.canvasState, (name) => {
        switch (name) {
          case "database":
          case "language":
          case "tableCase":
          case "columnCase":
            this.requestUpdate();
            break;
        }
      })
    );
    if (this.relationship) {
      this.subscriptionList.push(
        store.observe(this.relationship, (name) => {
          if (name === "relationshipType") {
            this.requestUpdate();
          }
        })
      );
    }
  }
  disconnectedCallback() {
    this.currentMenu = null;
    this.subscriptionList.forEach((sub) => sub.unsubscribe());
    super.disconnectedCallback();
  }

  render() {
    return html`
      <ul
        class="vuerd-contextmenu"
        style=${styleMap({
          left: `${this.x}px`,
          top: `${this.y}px`,
        })}
      >
        ${this.menus.map((menu) => {
          const icon = this.getIcon(menu);
          return html`
            <li
              @click=${() => this.onExecute(menu)}
              @mouseover=${() => this.onMouseover(menu)}
            >
              ${icon && menu.base64
                ? html`
                    <span class="icon">
                      <img src=${icon} />
                    </span>
                  `
                : icon
                ? html`
                    <span class="icon">
                      <vuerd-icon size="14" icon=${icon}> </vuerd-icon>
                    </span>
                  `
                : html`<span class="icon"></span>`}
              <span class="name">${menu.name}</span>
              <span class="keymap" title=${menu.keymap ? menu.keymap : ""}>
                ${menu.keymap}
              </span>
              ${menu.children
                ? html`
                    <span class="arrow">
                      <vuerd-icon size="13" icon="chevron-right"> </vuerd-icon>
                    </span>
                  `
                : ""}
            </li>
          `;
        })}
      </ul>
      ${this.currentMenu && this.currentMenu.children
        ? html`
            <vuerd-contextmenu
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
  private onExecute(menu: Menu) {
    if (!menu.children && menu.execute && typeof menu.execute === "function") {
      menu.execute(this.getRootNode() as ShadowRoot);
      if (
        !menu.option ||
        menu.option.close ||
        menu.option.close === undefined
      ) {
        this.context.eventBus.emit(Bus.ERD.contextmenuEnd);
      }
    }
  }

  private getIcon(menu: Menu): string | undefined {
    const { canvasState } = this.context.store;
    if (menu.option?.showKey) {
      const show = canvasState.show;
      return show[menu.option.showKey] ? "check" : undefined;
    } else if (menu.option?.database) {
      const database = canvasState.database;
      return menu.option.database === database ? "check" : undefined;
    } else if (menu.option?.language) {
      const language = canvasState.language;
      return menu.option.language === language ? "check" : undefined;
    } else if (menu.option?.tableCase) {
      const tableCase = canvasState.tableCase;
      return menu.option.tableCase === tableCase ? "check" : undefined;
    } else if (menu.option?.columnCase) {
      const columnCase = canvasState.columnCase;
      return menu.option.columnCase === columnCase ? "check" : undefined;
    } else if (this.relationship && menu.option?.relationshipType) {
      return this.relationship.relationshipType === menu.option.relationshipType
        ? "check"
        : undefined;
    }
    return menu.icon;
  }
}
