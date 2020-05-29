import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { Subscription, fromEvent } from "rxjs";
import { EditorElement } from "@src/components/EditorElement";
import { Logger } from "@src/core/Logger";
import { SIZE_MENUBAR_HEIGHT } from "@src/core/Layout";
import { AnimationFrame } from "@src/core/Animation";
import { keymapOptionToString } from "@src/core/Keymap";
import { Bus } from "@src/core/Event";

const PADDING = 10 * 2;
const HEIGHT = 30 + PADDING;

@customElement("vuerd-find")
class Find extends EditorElement {
  @property({ type: Boolean })
  animation = true;
  @property({ type: Number })
  top = 0;

  private animationFrame = new AnimationFrame<{ top: number }>(200);

  connectedCallback() {
    super.connectedCallback();
    const { eventBus } = this.context;
    const { mousedown$ } = this.context.windowEventObservable;
    const root = this.getRootNode() as ShadowRoot;
    const editor = root.querySelector(".vuerd-editor") as Element;
    this.subscriptionList.push(
      mousedown$.subscribe(this.onMousedownWindow),
      fromEvent<MouseEvent>(editor, "mousedown").subscribe(this.onMousedown),
      eventBus.on(Bus.Find.close).subscribe(this.onClose)
    );
    this.top = -1 * HEIGHT;
  }
  firstUpdated() {
    this.animationFrame
      .play({ top: -1 * HEIGHT }, { top: SIZE_MENUBAR_HEIGHT })
      .update((value) => {
        this.top = value.top;
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
        class="vuerd-find"
        style=${styleMap({
          top: `${this.top}px`,
          height: `${HEIGHT}px`,
        })}
      >
        <div class="vuerd-find-header">
          <h3>Find</h3>
          <vuerd-find-table @blur=${this.onClose}></vuerd-find-table>
          <vuerd-icon
            class="vuerd-button"
            title=${keymapStop}
            icon="times"
            size="12"
            @click=${this.onClose}
          ></vuerd-icon>
        </div>
      </div>
    `;
  }

  private onClose = () => {
    this.top = SIZE_MENUBAR_HEIGHT;
    this.animation = true;
    this.animationFrame
      .play({ top: SIZE_MENUBAR_HEIGHT }, { top: -1 * HEIGHT })
      .update((value) => {
        this.top = value.top;
      })
      .complete(() => {
        this.dispatchEvent(new CustomEvent("close"));
      })
      .start();
  };
  private onMousedown = (event: MouseEvent) => {
    const el = event.target as HTMLElement;
    if (!el.closest(".vuerd-find")) {
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
