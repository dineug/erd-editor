import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { fromEvent } from "rxjs";
import { EditorElement } from "./EditorElement";
import { Logger } from "@src/core/Logger";
import { defaultWidth } from "./Layout";
import { AnimationFrame } from "@src/core/Animation";
import { Bus } from "@src/core/Event";
import { keymapOptionToString } from "@src/core/Keymap";

const MAX_WIDTH = 800;

@customElement("vuerd-import-error-ddl")
class ImportErrorDDL extends EditorElement {
  @property({ type: Number })
  width = defaultWidth;
  @property({ type: Boolean })
  animation = true;
  @property({ type: Number })
  animationRight = defaultWidth;
  @property({ type: String })
  message = "";

  private animationFrame = new AnimationFrame<{ right: number }>(200);

  get drawerWidth() {
    let width = this.width / 2;
    if (width > MAX_WIDTH) {
      width = MAX_WIDTH;
    }
    return width;
  }

  get right() {
    return this.animation ? this.animationRight : 0;
  }

  connectedCallback() {
    super.connectedCallback();
    const { eventBus } = this.context;
    const root = this.getRootNode() as ShadowRoot;
    const editor = root.querySelector(".vuerd-editor") as Element;
    this.subscriptionList.push(
      fromEvent<MouseEvent>(editor, "mousedown").subscribe(this.onMousedown),
      eventBus.on(Bus.ImportErrorDDL.close).subscribe(this.onClose)
    );
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

  render() {
    const { keymap } = this.context;
    const keymapStop = keymapOptionToString(keymap.stop[0]);
    return html`
      <div
        class="vuerd-import-error-ddl"
        style=${styleMap({
          width: `${this.drawerWidth}px`,
          right: `${this.right}px`,
        })}
      >
        <div class="vuerd-import-error-ddl-header">
          <h3>Import SQL DDL Error</h3>
          <vuerd-icon
            class="vuerd-button"
            title=${keymapStop}
            icon="times"
            size="16"
            @click=${this.onClose}
          ></vuerd-icon>
        </div>
        <div class="vuerd-import-error-ddl-body vuerd-scrollbar">
          ${this.message}
        </div>
        <div class="vuerd-import-error-ddl-footer">
          <span>DDL Parser with</span>
          <span style="color: red;"> &nbsp;❤&nbsp;</span>
          <span> by&nbsp;</span>
          <a
            href="https://github.com/duartealexf/sql-ddl-to-json-schema"
            target="_blank"
          >
            sql-ddl-to-json-schema
          </a>
        </div>
      </div>
    `;
  }

  private onClose = () => {
    this.animation = true;
    this.animationFrame
      .play({ right: this.animationRight }, { right: -1 * this.drawerWidth })
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
    if (!el.closest(".vuerd-import-error-ddl")) {
      this.onClose();
    }
  };
}
