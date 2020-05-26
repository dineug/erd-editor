import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { Subscription } from "rxjs";
import { EditorElement } from "@src/components/EditorElement";
import { defaultWidth, defaultHeight } from "@src/components/Layout";
import { Logger } from "@src/core/Logger";
import { Move } from "@src/core/Event";
import {
  SIZE_MINIMAP_WIDTH,
  SIZE_MINIMAP_MARGIN,
  SIZE_MENUBAR_HEIGHT,
} from "@src/core/Layout";
import { moveCanvas } from "@src/core/command/canvas";

const MARGIN_TOP = SIZE_MENUBAR_HEIGHT + SIZE_MINIMAP_MARGIN;

@customElement("vuerd-minimap-handle")
class MinimapHandle extends EditorElement {
  @property({ type: Number })
  width = defaultWidth;
  @property({ type: Number })
  height = defaultHeight;

  private subMoveEnd: Subscription | null = null;
  private subMove: Subscription | null = null;

  get styleMap() {
    const { scrollLeft, scrollTop } = this.context.store.canvasState;
    const ratio = this.ratio;
    const x = scrollLeft * ratio;
    const y = scrollTop * ratio;
    const left =
      this.width - SIZE_MINIMAP_WIDTH - SIZE_MINIMAP_MARGIN + scrollLeft + x;
    const top = MARGIN_TOP + scrollTop + y;
    return {
      width: `${this.width * ratio}px`,
      height: `${this.height * ratio}px`,
      left: `${left}px`,
      top: `${top}px`,
    };
  }

  get ratio() {
    const { width } = this.context.store.canvasState;
    return SIZE_MINIMAP_WIDTH / width;
  }

  connectedCallback() {
    super.connectedCallback();
    const { store } = this.context;
    this.subscriptionList.push(
      store.observe(store.canvasState, (name) => {
        switch (name) {
          case "width":
          case "height":
          case "scrollLeft":
          case "scrollTop":
            this.requestUpdate();
            break;
        }
      })
    );
  }
  disconnectedCallback() {
    this.onMoveEnd();
    super.disconnectedCallback();
  }

  render() {
    return html`
      <div
        class="vuerd-minimap-handle"
        style=${styleMap(this.styleMap)}
        @mousedown=${this.onMoveStart}
        @touchstart=${this.onMoveStart}
      ></div>
    `;
  }

  private onMoveEnd = (event?: MouseEvent | TouchEvent) => {
    this.subMoveEnd?.unsubscribe();
    this.subMove?.unsubscribe();
    this.subMoveEnd = null;
    this.subMove = null;
  };
  private onMove = ({ event, movementX, movementY }: Move) => {
    if (event.type === "mousemove") {
      event.preventDefault();
    }
    const ratio = this.ratio;
    const root = this.getRootNode() as ShadowRoot;
    const erd = root.querySelector(".vuerd-erd") as Element;
    erd.scrollTop += movementY / ratio;
    erd.scrollLeft += movementX / ratio;
    const { store } = this.context;
    store.dispatch(moveCanvas(erd.scrollTop, erd.scrollLeft));
  };

  private onMoveStart() {
    const { moveEnd$, move$ } = this.context.windowEventObservable;
    this.onMoveEnd();
    this.subMoveEnd = moveEnd$.subscribe(this.onMoveEnd);
    this.subMove = move$.subscribe(this.onMove);
  }
}
