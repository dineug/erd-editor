import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { Subscription } from "rxjs";
import { EditorElement } from "./EditorElement";
import { Logger } from "@src/core/Logger";
import { defaultWidth, defaultHeight } from "./Layout";
import { Menu, getERDContextmenu } from "@src/core/Contextmenu";
import { Bus } from "@src/core/Event";
import { keymapMatch } from "@src/core/Keymap";
import {
  addTable,
  removeTable,
  selectEndTable,
  selectAllTable
} from "@src/core/command/table";
import { addColumn } from "@src/core/command/column";
import { addMemo, selectEndMemo, selectAllMemo } from "@src/core/command/memo";
import "./Canvas";

@customElement("vuerd-erd")
class ERD extends EditorElement {
  @property({ type: Number })
  width = defaultWidth;
  @property({ type: Number })
  height = defaultHeight;
  @property({ type: Boolean })
  contextmenu = false;
  @property({ type: Number })
  contextmenuX = 0;
  @property({ type: Number })
  contextmenuY = 0;

  private subKeydown!: Subscription;
  private menus: Menu[] = [];

  get theme() {
    return {
      width: `${this.width}px`,
      height: `${this.height}px`
    };
  }

  connectedCallback() {
    super.connectedCallback();
    Logger.debug("ERD before render");
    const { store, eventBus, keymap } = this.context;
    eventBus.on(Bus.ERD.contextmenuEnd, this.onContextmenuEnd);
    this.subKeydown = this.context.windowEventObservable.keydown$.subscribe(
      (event: KeyboardEvent) => {
        const { focus } = store.editorState;
        if (focus) {
          if (keymapMatch(event, keymap.addTable)) {
            store.dispatch([addTable(store)]);
          } else if (keymapMatch(event, keymap.removeTable)) {
            store.dispatch([removeTable(store)]);
          } else if (keymapMatch(event, keymap.addColumn)) {
            store.dispatch([addColumn(store)]);
          } else if (keymapMatch(event, keymap.addMemo)) {
            store.dispatch([addMemo(store)]);
          } else if (keymapMatch(event, keymap.selectAllTable)) {
            // TODO: if add not editor mod
            store.dispatch([selectAllTable(), selectAllMemo()]);
          }
        }
      }
    );
  }
  firstUpdated() {
    Logger.debug("ERD after render");
  }
  disconnectedCallback() {
    Logger.debug("ERD destroy");
    this.subKeydown.unsubscribe();
    this.context.eventBus.off(Bus.ERD.contextmenuEnd, this.onContextmenuEnd);
    super.disconnectedCallback();
  }

  render() {
    Logger.debug("ERD render");
    return html`
      <div
        class="vuerd-erd"
        style=${styleMap(this.theme)}
        @mousedown=${this.onMousedown}
        @contextmenu=${this.onContextmenu}
      >
        <vuerd-canvas .context=${this.context}></vuerd-canvas>
        ${this.contextmenu
          ? html`
              <vuerd-contextmenu
                .context=${this.context}
                .menus=${this.menus}
                .x=${this.contextmenuX}
                .y=${this.contextmenuY}
              ></vuerd-contextmenu>
            `
          : ``}
      </div>
    `;
  }

  private onContextmenu = (event: MouseEvent) => {
    event.preventDefault();
    const { store, keymap } = this.context;
    this.menus = getERDContextmenu(store, keymap);
    this.contextmenuX = event.x;
    this.contextmenuY = event.y;
    this.contextmenu = true;
  };

  private onContextmenuEnd = (event: Event) => {
    this.contextmenu = false;
  };
  private onMousedown = (event: MouseEvent) => {
    const el = event.target as HTMLElement;
    if (!el.closest(".vuerd-contextmenu")) {
      this.contextmenu = false;
    }
    if (
      !el.closest(".vuerd-contextmenu") &&
      !el.closest(".vuerd-table") &&
      !el.closest(".vuerd-memo")
    ) {
      const { store } = this.context;
      store.dispatch([selectEndTable(), selectEndMemo()]);
    }
  };
}
