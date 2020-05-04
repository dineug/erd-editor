import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { Subscription, fromEvent } from "rxjs";
import { EditorElement } from "./EditorElement";
import { Logger } from "@src/core/Logger";
import { defaultWidth } from "./Layout";
import { AnimationFrame } from "@src/core/Animation";
import { Bus } from "@src/core/Event";
import { keymapOptionToStringJoin } from "@src/core/Keymap";

const MAX_WIDTH = 800;

interface HelpDescribe {
  name: string;
  keymap: string;
}

@customElement("vuerd-help")
class Help extends EditorElement {
  @property({ type: Number })
  width = defaultWidth;
  @property({ type: Boolean })
  animation = true;
  @property({ type: Number })
  animationRight = defaultWidth;

  private animationFrame = new AnimationFrame<{ right: number }>(200);
  private subscriptionList: Subscription[] = [];

  get drawerWidth() {
    let width = this.width / 2;
    if (width > MAX_WIDTH) {
      width = MAX_WIDTH;
    }
    return width;
  }

  get right() {
    return this.animate ? this.animationRight : 0;
  }

  get helpDescribe(): HelpDescribe[] {
    const { keymap } = this.context;
    const describeList: HelpDescribe[] = [];
    describeList.push(
      {
        name: "Editing - ERD",
        keymap: `dblclick, ${keymapOptionToStringJoin(keymap.edit)}`,
      },
      {
        name: "Editing - Grid",
        keymap: "dblclick, Enter",
      },
      {
        name: "All Stop",
        keymap: keymapOptionToStringJoin(keymap.stop),
      },
      {
        name: "filter",
        keymap: keymapOptionToStringJoin(keymap.find),
      },
      {
        name: "Selection - table, memo",
        keymap: `Ctrl + Drag, Click, Ctrl + Click, ${keymapOptionToStringJoin(
          keymap.selectAllTable
        )}`,
      },
      {
        name: "Selection - column, filter",
        keymap: `Click, Ctrl + Click, Shift + Click, Shift + Arrow key(up, down), ${keymapOptionToStringJoin(
          keymap.selectAllColumn
        )}`,
      },
      {
        name: "Movement - table, memo, column",
        keymap: "Drag, Ctrl + Drag",
      },
      {
        name: "Copy - column",
        keymap: keymapOptionToStringJoin(keymap.copyColumn),
      },
      {
        name: "Paste - column",
        keymap: keymapOptionToStringJoin(keymap.pasteColumn),
      },
      {
        name: "Contextmenu - ERD, Relationship, SQL, GeneratorCode",
        keymap: "Right-click",
      },
      {
        name: "New Table",
        keymap: keymapOptionToStringJoin(keymap.addTable),
      },
      {
        name: "New Memo",
        keymap: keymapOptionToStringJoin(keymap.addMemo),
      },
      {
        name: "New - Column, filter",
        keymap: keymapOptionToStringJoin(keymap.addColumn),
      },
      {
        name: "Delete - table, memo",
        keymap: keymapOptionToStringJoin(keymap.removeTable),
      },
      {
        name: "Delete - column, filter",
        keymap: keymapOptionToStringJoin(keymap.removeColumn),
      },
      {
        name: "Select DataType Hint",
        keymap: "Arrow key(right), Click",
      },
      {
        name: "Move DataType Hint",
        keymap: "Arrow key(up, down)",
      },
      {
        name: "Primary Key",
        keymap: keymapOptionToStringJoin(keymap.primaryKey),
      },
      {
        name: "checkbox - Grid, filter",
        keymap: "Space, Click",
      },
      {
        name: "Move checkbox - Grid, filter",
        keymap: "Arrow key(up, down, left, right)",
      },
      {
        name: "Relationship - Zero One N",
        keymap: keymapOptionToStringJoin(keymap.relationshipZeroOneN),
      },
      {
        name: "Relationship - Zero One",
        keymap: keymapOptionToStringJoin(keymap.relationshipZeroOne),
      },
      {
        name: "Relationship - Zero N",
        keymap: keymapOptionToStringJoin(keymap.relationshipZeroN),
      },
      {
        name: "Relationship - One Only",
        keymap: keymapOptionToStringJoin(keymap.relationshipOneOnly),
      },
      {
        name: "Relationship - One N",
        keymap: keymapOptionToStringJoin(keymap.relationshipOneN),
      },
      {
        name: "Relationship - One",
        keymap: keymapOptionToStringJoin(keymap.relationshipOne),
      },
      {
        name: "Relationship - N",
        keymap: keymapOptionToStringJoin(keymap.relationshipN),
      }
    );
    return describeList;
  }

  connectedCallback() {
    super.connectedCallback();
    const { eventBus } = this.context;
    const { mousedown$ } = this.context.windowEventObservable;
    const root = this.getRootNode() as ShadowRoot;
    const editor = root.querySelector(".vuerd-editor") as Element;
    this.subscriptionList.push(
      mousedown$.subscribe(this.onMousedownWindow),
      fromEvent<MouseEvent>(editor, "mousedown").subscribe(this.onMousedown)
    );
    eventBus.on(Bus.Help.close, this.onClose);
    this.animationRight = -1 * this.drawerWidth;
  }
  firstUpdated() {
    this.animationFrame
      .play({ right: -1 * this.drawerWidth }, { right: 0 })
      .update((value) => {
        this.animationRight = value.right;
      })
      .complete(() => {
        this.animation = false;
      })
      .start();
  }
  disconnectedCallback() {
    const { eventBus } = this.context;
    eventBus.off(Bus.Help.close, this.onClose);
    this.subscriptionList.forEach((sub) => sub.unsubscribe());
    super.disconnectedCallback();
  }

  render() {
    return html`
      <div
        class="vuerd-help"
        style=${styleMap({
          width: `${this.drawerWidth}px`,
          right: `${this.right}px`,
        })}
      >
        <div class="vuerd-help-header">
          <h3>Help</h3>
          <vuerd-icon
            class="vuerd-button"
            title="ESC"
            icon="times"
            size="16"
            @click=${this.onClose}
          ></vuerd-icon>
        </div>
        <div class="vuerd-help-body vuerd-scrollbar">
          <table>
            <thead>
              <th>Name</th>
              <th>Keymap</th>
            </thead>
            <tbody>
              ${this.helpDescribe.map(
                (describe) => html`
                  <tr>
                    <td>${describe.name}</td>
                    <td>${describe.keymap}</td>
                  </tr>
                `
              )}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  private onClose = () => {
    this.animationRight = 0;
    this.animation = true;
    this.animationFrame
      .play({ right: 0 }, { right: -1 * this.drawerWidth })
      .update((value) => {
        this.animationRight = value.right;
      })
      .complete(() => {
        this.dispatchEvent(new CustomEvent("close"));
      })
      .start();
  };
  private onMousedown = (event: MouseEvent) => {
    const el = event.target as HTMLElement;
    if (!el.closest(".vuerd-help")) {
      this.onClose();
    }
  };
  private onMousedownWindow = (event: MouseEvent) => {
    const el = event.target as HTMLElement;
    const root = this.getRootNode() as ShadowRoot;
    if (!el.closest(root.host.localName)) {
      this.onClose();
    }
  };
}
