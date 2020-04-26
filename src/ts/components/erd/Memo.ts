import { html, customElement } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { classMap } from "lit-html/directives/class-map";
import { Subscription } from "rxjs";
import { EditorElement } from "@src/components/EditorElement";
import { Logger } from "@src/core/Logger";
import {
  SIZE_MEMO_PADDING,
  SIZE_MEMO_WIDTH,
  SIZE_MEMO_HEIGHT,
  SIZE_MENUBAR_HEIGHT,
} from "@src/core/Layout";
import { keymapOptionToString } from "@src/core/Keymap";
import { Bus, Move } from "@src/core/Event";
import { AnimationFrame } from "@src/core/Animation";
import { Memo as MemoModel } from "@src/core/store/Memo";
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
  private subMoveEnd: Subscription | null = null;
  private subMove: Subscription | null = null;
  private subLerp: Subscription | null = null;
  private x = 0;
  private y = 0;
  private animationFrameX = new AnimationFrame<{ x: number }>(200);
  private animationFrameY = new AnimationFrame<{ y: number }>(200);
  private lerp = false;
  private lerpTop = 0;
  private lerpLeft = 0;

  get width(): number {
    const { ui } = this.memo;
    return ui.width + MEMO_PADDING;
  }

  get height(): number {
    const { ui } = this.memo;
    return ui.height + MEMO_PADDING + MEMO_HEADER;
  }

  get top() {
    const { ui } = this.memo;
    return this.lerp ? this.lerpTop : ui.top;
  }
  get left() {
    const { ui } = this.memo;
    return this.lerp ? this.lerpLeft : ui.left;
  }

  connectedCallback() {
    super.connectedCallback();
    const { store, eventBus } = this.context;
    this.subscriptionList.push(
      store.observe(this.memo.ui, () => this.requestUpdate())
    );
    eventBus.on(Bus.Memo.moveValid, this.onMoveValid);
  }
  firstUpdated() {
    const textarea = this.renderRoot.querySelector(
      "textarea"
    ) as HTMLTextAreaElement;
    textarea.focus();
  }
  disconnectedCallback() {
    const { eventBus } = this.context;
    eventBus.off(Bus.Memo.moveValid, this.onMoveValid);
    this.onMoveEnd();
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
          top: `${this.top}px`,
          left: `${this.left}px`,
          zIndex: `${ui.zIndex}`,
          width: `${this.width}px`,
          height: `${this.height}px`,
        })}
        @mousedown=${this.onMoveStart}
        @touchstart=${this.onMoveStart}
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

  private onMoveEnd = (event?: MouseEvent | TouchEvent) => {
    const { eventBus } = this.context;
    this.subMoveEnd?.unsubscribe();
    this.subMove?.unsubscribe();
    this.subLerp?.unsubscribe();
    this.subMoveEnd = null;
    this.subMove = null;
    this.subLerp = null;
    this.lerp = false;
    eventBus.emit(Bus.Table.moveValid);
    eventBus.emit(Bus.Memo.moveValid);
    this.requestUpdate();
  };
  private onMove = ({ event, movementX, movementY }: Move) => {
    if (event.type === "mousemove") {
      event.preventDefault();
    }
    const { store } = this.context;
    store.dispatch(
      moveMemo(store, event.ctrlKey, movementX, movementY, this.memo.id)
    );
  };
  private onMoveValid = () => {
    const { width, height } = this.context.store.canvasState;
    let x = 0;
    let y = SIZE_MENUBAR_HEIGHT;
    const minWidth = width - (this.memo.ui.width + MEMO_PADDING);
    const minHeight =
      height - (this.memo.ui.height + MEMO_PADDING + MEMO_HEADER);
    if (this.memo.ui.left > minWidth) {
      x = minWidth;
    }
    if (this.memo.ui.top > minHeight) {
      y = minHeight;
    }
    if (this.memo.ui.left < 0 || this.memo.ui.left > minWidth) {
      this.animationFrameX
        .play({ x: this.memo.ui.left }, { x })
        .update((value) => (this.memo.ui.left = value.x))
        .start();
    }
    if (
      this.memo.ui.top < SIZE_MENUBAR_HEIGHT ||
      this.memo.ui.top > minHeight
    ) {
      this.animationFrameY
        .play({ y: this.memo.ui.top }, { y })
        .update((value) => (this.memo.ui.top = value.y))
        .start();
    }
  };

  private onMoveStart(event: MouseEvent | TouchEvent) {
    const el = event.target as HTMLElement;
    if (
      !el.closest(".vuerd-button") &&
      !el.closest(".vuerd-sash") &&
      !el.closest(".vuerd-memo-textarea")
    ) {
      const {
        moveEnd$,
        move$,
        requestAnimationFrame$,
      } = this.context.windowEventObservable;
      const { ui } = this.memo;
      this.onMoveEnd();
      this.lerpTop = ui.top;
      this.lerpLeft = ui.left;
      this.lerp = true;
      this.subMoveEnd = moveEnd$.subscribe(this.onMoveEnd);
      this.subMove = move$.subscribe(this.onMove);
      this.subLerp = requestAnimationFrame$.subscribe(() => {
        this.lerpTop += (ui.top - this.lerpTop) * 0.3;
        this.lerpLeft += (ui.left - this.lerpLeft) * 0.3;
        this.requestUpdate();
      });
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
    this.x = event.clientX;
    this.y = event.clientY;
    const { moveEnd$, move$ } = this.context.windowEventObservable;
    this.onMoveEnd();
    this.subMoveEnd = moveEnd$.subscribe(this.onMoveEnd);
    this.subMove = move$.subscribe((move) => {
      this.onMousemoveSash(move, position);
    });
  }
  private onMousemoveSash(move: Move, position: Position) {
    move.event.preventDefault();
    const { store } = this.context;
    let verticalUI: ResizeMemo | null = null;
    let horizontalUI: ResizeMemo | null = null;
    switch (position) {
      case "left":
      case "right":
        verticalUI = this.resizeWidth(move, position);
        break;
      case "top":
      case "bottom":
        horizontalUI = this.resizeHeight(move, position);
        break;
      case "lt":
        verticalUI = this.resizeWidth(move, "left");
        horizontalUI = this.resizeHeight(move, "top");
        break;
      case "rt":
        verticalUI = this.resizeWidth(move, "right");
        horizontalUI = this.resizeHeight(move, "top");
        break;
      case "lb":
        verticalUI = this.resizeWidth(move, "left");
        horizontalUI = this.resizeHeight(move, "bottom");
        break;
      case "rb":
        verticalUI = this.resizeWidth(move, "right");
        horizontalUI = this.resizeHeight(move, "bottom");
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

  private resizeWidth(
    { event, movementX, x }: Move,
    direction: Direction
  ): ResizeMemo {
    const ui = Object.assign({ change: false }, this.memo.ui);
    const mouseDirection: Direction = movementX < 0 ? "left" : "right";
    const width =
      direction === "left" ? ui.width - movementX : ui.width + movementX;
    switch (mouseDirection) {
      case "left":
        if (SIZE_MEMO_WIDTH < width && x < this.x) {
          ui.width = width;
          if (direction === "left") {
            ui.left += movementX;
          }
          this.x += movementX;
          ui.change = true;
        }
        break;
      case "right":
        if (SIZE_MEMO_WIDTH < width && x > this.x) {
          ui.width = width;
          if (direction === "left") {
            ui.left += movementX;
          }
          this.x += movementX;
          ui.change = true;
        }
        break;
    }
    return ui;
  }
  private resizeHeight(
    { event, movementY, y }: Move,
    direction: Direction
  ): ResizeMemo {
    const ui = Object.assign({ change: false }, this.memo.ui);
    const mouseDirection: Direction = movementY < 0 ? "top" : "bottom";
    const height =
      direction === "top" ? ui.height - movementY : ui.height + movementY;
    switch (mouseDirection) {
      case "top":
        if (SIZE_MEMO_HEIGHT < height && y < this.y) {
          ui.height = height;
          if (direction === "top") {
            ui.top += movementY;
          }
          this.y += movementY;
          ui.change = true;
        }
        break;
      case "bottom":
        if (SIZE_MEMO_HEIGHT < height && y > this.y) {
          ui.height = height;
          if (direction === "top") {
            ui.top += movementY;
          }
          this.y += movementY;
          ui.change = true;
        }
        break;
    }
    return ui;
  }
}
