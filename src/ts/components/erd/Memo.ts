import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { classMap } from "lit-html/directives/class-map";
import { Subscription } from "rxjs";
import { EditorElement } from "@src/components/EditorElement";
import { Logger } from "@src/core/Logger";
import {
  SIZE_MEMO_PADDING,
  SIZE_MEMO_WIDTH,
  SIZE_MEMO_HEIGHT,
} from "@src/core/Layout";
import { keymapOptionToString } from "@src/core/Keymap";
import { Memo as MemoModel, MemoUI } from "@src/core/store/Memo";
import {
  moveMemo,
  selectMemo,
  removeMemo,
  changeMemoValue,
  resizeMemo,
} from "@src/core/command/memo";

const MEMO_PADDING = SIZE_MEMO_PADDING * 2;
const MEMO_HEADER = 17 + SIZE_MEMO_PADDING;

type Direction = "left" | "right" | "top" | "bottom";
type Position = "left" | "right" | "top" | "bottom" | "lt" | "rt" | "lb" | "rb";

interface ResizeMemo {
  change: boolean;
  top: number;
  left: number;
  width: number;
  height: number;
}

@customElement("vuerd-memo")
class Memo extends EditorElement {
  memo!: MemoModel;

  private subscriptionList: Subscription[] = [];
  private subMouseup: Subscription | null = null;
  private subMousemove: Subscription | null = null;
  private x = 0;
  private y = 0;

  get width(): number {
    const { ui } = this.memo;
    return ui.width + MEMO_PADDING;
  }

  get height(): number {
    const { ui } = this.memo;
    return ui.height + MEMO_PADDING + MEMO_HEADER;
  }

  connectedCallback() {
    super.connectedCallback();
    const { store } = this.context;
    this.subscriptionList.push(
      store.observe(this.memo.ui, () => this.requestUpdate())
    );
  }
  firstUpdated() {
    const textarea = this.renderRoot.querySelector(
      "textarea"
    ) as HTMLTextAreaElement;
    textarea.focus();
  }
  disconnectedCallback() {
    this.onMouseup();
    this.subscriptionList.forEach((sub) => sub.unsubscribe());
    super.disconnectedCallback();
  }

  render() {
    const { ui } = this.memo;
    const { keymap } = this.context;
    const keymapRemoveTable = keymapOptionToString(keymap.removeTable[0]);
    return html`
      <div
        class=${classMap({
          "vuerd-memo": true,
          active: ui.active,
        })}
        style=${styleMap({
          top: `${ui.top}px`,
          left: `${ui.left}px`,
          zIndex: `${ui.zIndex}`,
          width: `${this.width}px`,
          height: `${this.height}px`,
        })}
        @mousedown=${this.onMousedown}
      >
        <div class="vuerd-memo-header">
          <vuerd-icon
            class="vuerd-button"
            title=${keymapRemoveTable}
            icon="times"
            size="12"
            @click=${this.onRemoveMemo}
          ></vuerd-icon>
        </div>
        <div class="vuerd-memo-body">
          <textarea
            class="vuerd-memo-textarea vuerd-scrollbar"
            style=${styleMap({
              width: `${ui.width}px`,
              height: `${ui.height}px`,
            })}
            spellcheck="false"
            .value=${this.memo.value}
            @input=${this.onInput}
          ></textarea>
        </div>
        <vuerd-sash
          vertical
          @mousedown=${(event: MouseEvent) =>
            this.onMousedownSash(event, "left")}
        ></vuerd-sash>
        <vuerd-sash
          vertical
          .left=${this.width}
          @mousedown=${(event: MouseEvent) =>
            this.onMousedownSash(event, "right")}
        ></vuerd-sash>
        <vuerd-sash
          horizontal
          @mousedown=${(event: MouseEvent) =>
            this.onMousedownSash(event, "top")}
        ></vuerd-sash>
        <vuerd-sash
          horizontal
          .top=${this.height}
          @mousedown=${(event: MouseEvent) =>
            this.onMousedownSash(event, "bottom")}
        ></vuerd-sash>
        <vuerd-sash
          edge
          cursor="nw-resize"
          @mousedown=${(event: MouseEvent) => this.onMousedownSash(event, "lt")}
        ></vuerd-sash>
        <vuerd-sash
          edge
          cursor="ne-resize"
          .left=${this.width}
          @mousedown=${(event: MouseEvent) => this.onMousedownSash(event, "rt")}
        ></vuerd-sash>
        <vuerd-sash
          edge
          cursor="ne-resize"
          .top=${this.height}
          @mousedown=${(event: MouseEvent) => this.onMousedownSash(event, "lb")}
        ></vuerd-sash>
        <vuerd-sash
          edge
          cursor="nw-resize"
          .left=${this.width}
          .top=${this.height}
          @mousedown=${(event: MouseEvent) => this.onMousedownSash(event, "rb")}
        ></vuerd-sash>
      </div>
    `;
  }

  private onMouseup = (event?: MouseEvent) => {
    this.subMouseup?.unsubscribe();
    this.subMousemove?.unsubscribe();
    this.subMouseup = null;
    this.subMousemove = null;
  };
  private onMousemove = (event: MouseEvent) => {
    event.preventDefault();
    let movementX = event.movementX / window.devicePixelRatio;
    let movementY = event.movementY / window.devicePixelRatio;
    // firefox
    if (window.navigator.userAgent.toLowerCase().indexOf("firefox") !== -1) {
      movementX = event.movementX;
      movementY = event.movementY;
    }
    const { store } = this.context;
    store.dispatch(
      moveMemo(store, event.ctrlKey, movementX, movementY, this.memo.id)
    );
  };

  private onMousedown(event: MouseEvent) {
    const el = event.target as HTMLElement;
    if (
      !el.closest(".vuerd-button") &&
      !el.closest(".vuerd-sash") &&
      !el.closest(".vuerd-memo-textarea")
    ) {
      const { mouseup$, mousemove$ } = this.context.windowEventObservable;
      this.onMouseup();
      this.subMouseup = mouseup$.subscribe(this.onMouseup);
      this.subMousemove = mousemove$.subscribe(this.onMousemove);
    }
    const { store } = this.context;
    store.dispatch(selectMemo(store, event.ctrlKey, this.memo.id));
  }
  private onRemoveMemo(event: MouseEvent) {
    const { store } = this.context;
    store.dispatch(removeMemo(store, this.memo.id));
  }
  private onInput(event: InputEvent) {
    const { store } = this.context;
    const textarea = event.target as HTMLTextAreaElement;
    store.dispatch(changeMemoValue(this.memo.id, textarea.value));
  }
  private onMousedownSash(event: MouseEvent, position: Position) {
    this.x = event.x;
    this.y = event.y;
    const { mouseup$, mousemove$ } = this.context.windowEventObservable;
    this.onMouseup();
    this.subMouseup = mouseup$.subscribe(this.onMouseup);
    this.subMousemove = mousemove$.subscribe((event) => {
      this.onMousemoveSash(event, position);
    });
  }
  private onMousemoveSash(event: MouseEvent, position: Position) {
    event.preventDefault();
    const { store } = this.context;
    let verticalUI: ResizeMemo | null = null;
    let horizontalUI: ResizeMemo | null = null;
    switch (position) {
      case "left":
      case "right":
        verticalUI = this.resizeWidth(event, position);
        break;
      case "top":
      case "bottom":
        horizontalUI = this.resizeHeight(event, position);
        break;
      case "lt":
        verticalUI = this.resizeWidth(event, "left");
        horizontalUI = this.resizeHeight(event, "top");
        break;
      case "rt":
        verticalUI = this.resizeWidth(event, "right");
        horizontalUI = this.resizeHeight(event, "top");
        break;
      case "lb":
        verticalUI = this.resizeWidth(event, "left");
        horizontalUI = this.resizeHeight(event, "bottom");
        break;
      case "rb":
        verticalUI = this.resizeWidth(event, "right");
        horizontalUI = this.resizeHeight(event, "bottom");
        break;
    }
    if (verticalUI?.change && horizontalUI?.change) {
      store.dispatch(
        resizeMemo(
          this.memo.id,
          horizontalUI.top,
          verticalUI.left,
          verticalUI.width,
          horizontalUI.height
        )
      );
    } else if (verticalUI?.change) {
      store.dispatch(
        resizeMemo(
          this.memo.id,
          verticalUI.top,
          verticalUI.left,
          verticalUI.width,
          verticalUI.height
        )
      );
    } else if (horizontalUI?.change) {
      store.dispatch(
        resizeMemo(
          this.memo.id,
          horizontalUI.top,
          horizontalUI.left,
          horizontalUI.width,
          horizontalUI.height
        )
      );
    }
  }

  private resizeWidth(event: MouseEvent, direction: Direction): ResizeMemo {
    const ui = Object.assign({ change: false }, this.memo.ui);
    const mouseDirection: Direction = event.movementX < 0 ? "left" : "right";
    const width =
      direction === "left"
        ? ui.width - event.movementX
        : ui.width + event.movementX;
    switch (mouseDirection) {
      case "left":
        if (SIZE_MEMO_WIDTH < width && event.x < this.x) {
          ui.width = width;
          if (direction === "left") {
            ui.left += event.movementX;
          }
          this.x += event.movementX;
          ui.change = true;
        }
        break;
      case "right":
        if (SIZE_MEMO_WIDTH < width && event.x > this.x) {
          ui.width = width;
          if (direction === "left") {
            ui.left += event.movementX;
          }
          this.x += event.movementX;
          ui.change = true;
        }
        break;
    }
    return ui;
  }
  private resizeHeight(event: MouseEvent, direction: Direction): ResizeMemo {
    const ui = Object.assign({ change: false }, this.memo.ui);
    const mouseDirection: Direction = event.movementY < 0 ? "top" : "bottom";
    const height =
      direction === "top"
        ? ui.height - event.movementY
        : ui.height + event.movementY;
    switch (mouseDirection) {
      case "top":
        if (SIZE_MEMO_HEIGHT < height && event.y < this.y) {
          ui.height = height;
          if (direction === "top") {
            ui.top += event.movementY;
          }
          this.y += event.movementY;
          ui.change = true;
        }
        break;
      case "bottom":
        if (SIZE_MEMO_HEIGHT < height && event.y > this.y) {
          ui.height = height;
          if (direction === "top") {
            ui.top += event.movementY;
          }
          this.y += event.movementY;
          ui.change = true;
        }
        break;
    }
    return ui;
  }
}
