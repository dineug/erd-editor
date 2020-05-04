import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { Subscription, fromEvent } from "rxjs";
import { EditorElement } from "@src/components/EditorElement";
import { Logger } from "@src/core/Logger";
import { SIZE_MENUBAR_HEIGHT } from "@src/core/Layout";
import { AnimationFrame } from "@src/core/Animation";

const HEIGHT = 100;

@customElement("vuerd-finder")
class Finder extends EditorElement {
  @property({ type: Boolean })
  animation = true;
  @property({ type: Number })
  top = 0;

  private animationFrame = new AnimationFrame<{ top: number }>(200);
  private subscriptionList: Subscription[] = [];

  connectedCallback() {
    super.connectedCallback();
    const { mousedown$ } = this.context.windowEventObservable;
    const root = this.getRootNode() as ShadowRoot;
    const editor = root.querySelector(".vuerd-editor") as Element;
    this.subscriptionList.push(
      mousedown$.subscribe(this.onMousedownWindow),
      fromEvent<MouseEvent>(editor, "mousedown").subscribe(this.onMousedown)
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
  disconnectedCallback() {
    this.subscriptionList.forEach((sub) => sub.unsubscribe());
    super.disconnectedCallback();
  }

  render() {
    return html`
      <div
        class="vuerd-finder"
        style=${styleMap({
          top: `${this.top}px`,
          height: `${HEIGHT}px`,
        })}
      ></div>
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
    if (!el.closest(".vuerd-finder")) {
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
