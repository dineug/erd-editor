import { svg, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { Subscription, fromEvent } from "rxjs";
import { EditorElement } from "@src/components/EditorElement";
import { Logger } from "@src/core/Logger";
import { dragSelectTable } from "@src/core/command/table";
import { dragSelectMemo } from "@src/core/command/memo";

const MARGIN = 4;

@customElement("vuerd-drag-select")
class DargSelect extends EditorElement {
  @property({ type: Number })
  x = 0;
  @property({ type: Number })
  y = 0;
  @property({ type: Number })
  ghostX = 0;
  @property({ type: Number })
  ghostY = 0;
  @property({ type: Number })
  top = 0;
  @property({ type: Number })
  left = 0;
  @property({ type: Number })
  width = 0;
  @property({ type: Number })
  height = 0;

  private subscriptionList: Subscription[] = [];

  connectedCallback() {
    super.connectedCallback();
    const { mouseup$, mousemove$ } = this.context.windowEventObservable;
    const root = this.getRootNode() as ShadowRoot;
    const erd = root.querySelector(".vuerd-erd") as Element;
    this.subscriptionList.push.apply(this.subscriptionList, [
      mouseup$.subscribe(this.onMouseup),
      mousemove$.subscribe(this.onMousemove),
      fromEvent<MouseEvent>(erd, "mousemove").subscribe(this.onMousemoveERD),
    ]);
  }
  disconnectedCallback() {
    this.subscriptionList.forEach((sub) => sub.unsubscribe());
    super.disconnectedCallback();
  }

  render() {
    return svg`
      <svg 
        class="vuerd-drag-select" 
        style=${styleMap({
          top: `${this.top}px`,
          left: `${this.left}px`,
          width: `${this.width}px`,
          height: `${this.height}px`,
        })}
      >
        <rect
          width=${this.width}
          height=${this.height}
          stroke-width="1"
          stroke-opacity="0.9"
          stroke-dasharray="3"
          fill-opacity="0.3"
        >
        </rect>
      </svg>
    `;
  }

  private onMouseup = (event?: MouseEvent) => {
    this.dispatchEvent(new CustomEvent("select-end"));
  };
  private onMousemove = (event: MouseEvent) => {
    event.preventDefault();
    if (!event.ctrlKey) {
      this.dispatchEvent(new CustomEvent("select-end"));
    }
  };
  private onMousemoveERD = (event: MouseEvent) => {
    event.preventDefault();
    const currentX = event.x;
    const currentY = event.y;
    const currentMinX = this.x > currentX;
    const currentMinY = this.y > currentY;
    const min = {
      x: this.x < currentX ? this.x : currentX,
      y: this.y < currentY ? this.y : currentY,
    };
    const max = {
      x: this.x > currentX ? this.x : currentX,
      y: this.y > currentY ? this.y : currentY,
    };
    if (currentMinX) {
      this.left = min.x + MARGIN;
      this.width = max.x - min.x;
    } else {
      this.left = min.x;
      this.width = max.x - min.x - MARGIN;
      if (this.width < 0) {
        this.width = 0;
      }
    }
    if (currentMinY) {
      this.top = min.y + MARGIN;
      this.height = max.y - min.y;
    } else {
      this.top = min.y;
      this.height = max.y - min.y - MARGIN;
      if (this.height < 0) {
        this.height = 0;
      }
    }

    const el = event.target as HTMLElement;
    if (
      !el.closest(".vuerd-table") &&
      !el.closest(".vuerd-memo") &&
      !el.closest(".vuerd-contextmenu") &&
      !el.closest(".vuerd-minimap") &&
      !el.closest(".vuerd-minimap-handle")
    ) {
      const ghostCurrentX = event.offsetX;
      const ghostCurrentY = event.offsetY;
      const ghostMin = {
        x: this.ghostX < ghostCurrentX ? this.ghostX : ghostCurrentX,
        y: this.ghostY < ghostCurrentY ? this.ghostY : ghostCurrentY,
      };
      const ghostMax = {
        x: this.ghostX > ghostCurrentX ? this.ghostX : ghostCurrentX,
        y: this.ghostY > ghostCurrentY ? this.ghostY : ghostCurrentY,
      };
      const { store } = this.context;
      store.dispatch(
        dragSelectTable(ghostMin, ghostMax),
        dragSelectMemo(ghostMin, ghostMax)
      );
    }
  };
}
