import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { classMap } from "lit-html/directives/class-map";
import { repeat } from "lit-html/directives/repeat";
import { Subject, fromEvent, Subscription } from "rxjs";
import { debounceTime, throttleTime } from "rxjs/operators";
import { EditorElement } from "./EditorElement";
import { Logger } from "@src/core/Logger";
import { defaultWidth } from "./Layout";
import { AnimationFrame, FlipAnimation } from "@src/core/Animation";
import { Bus } from "@src/core/Event";
import { keymapOptionToString } from "@src/core/Keymap";
import { ColumnType } from "@src/core/store/Canvas";
import {
  changeRelationshipDataTypeSync,
  moveColumnOrder,
} from "@src/core/command/canvas";

const MAX_WIDTH = 800;

@customElement("vuerd-setting")
class Setting extends EditorElement {
  @property({ type: Number })
  width = defaultWidth;
  @property({ type: Boolean })
  animation = true;
  @property({ type: Number })
  animationRight = defaultWidth;
  @property({ type: String })
  currentColumnType: ColumnType | null = null;

  private animationFrame = new AnimationFrame<{ right: number }>(200);
  private flipAnimation = new FlipAnimation(
    this.renderRoot,
    ".vuerd-column-order",
    "vuerd-column-order-move"
  );
  private draggable$: Subject<ColumnType> = new Subject();
  private subDraggable: Subscription[] = [];

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
    const { eventBus, store } = this.context;
    const { setting } = store.canvasState;
    const root = this.getRootNode() as ShadowRoot;
    const editor = root.querySelector(".vuerd-editor") as Element;
    this.subscriptionList.push(
      this.draggable$
        .pipe(debounceTime(50))
        .subscribe(this.onDragoverGroupColumnOrder),
      fromEvent<MouseEvent>(editor, "mousedown").subscribe(this.onMousedown),
      eventBus.on(Bus.Setting.close).subscribe(this.onClose),
      store.observe(setting.columnOrder, () => this.requestUpdate()),
      store.observe(setting, (name) => {
        if (name === "relationshipDataTypeSync") {
          this.requestUpdate();
        }
      })
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
  updated(changedProperties: any) {
    this.flipAnimation.play();
  }
  disconnectedCallback() {
    this.subDraggable.forEach((sub) => sub.unsubscribe);
    super.disconnectedCallback();
  }

  render() {
    const { keymap } = this.context;
    const keymapStop = keymapOptionToString(keymap.stop[0]);
    const { setting } = this.context.store.canvasState;
    return html`
      <div
        class="vuerd-setting"
        style=${styleMap({
          width: `${this.drawerWidth}px`,
          right: `${this.right}px`,
        })}
      >
        <div class="vuerd-setting-header">
          <h3>Setting</h3>
          <vuerd-icon
            class="vuerd-button"
            title=${keymapStop}
            icon="times"
            size="16"
            @click=${this.onClose}
          ></vuerd-icon>
        </div>
        <div class="vuerd-setting-body vuerd-scrollbar">
          <table>
            <colgroup>
              <col width="190px" />
            </colgroup>
            <tbody>
              <tr>
                <td>
                  Relationship DataType Sync
                </td>
                <td>
                  <label class="vuerd-switch">
                    <input
                      type="checkbox"
                      ?checked=${setting.relationshipDataTypeSync}
                      @change=${this.onChangeRelationshipDataTypeSync}
                    />
                    <span class="slider round"></span>
                  </label>
                </td>
              </tr>
              <tr>
                <td>ColumnType Order</td>
                <td>
                  ${repeat(
                    setting.columnOrder,
                    (columnType) => columnType,
                    (columnType) =>
                      html`
                        <div
                          class=${classMap({
                            "vuerd-column-order": true,
                            draggable: this.currentColumnType === columnType,
                          })}
                          data-id=${columnType}
                          draggable="true"
                          @dragstart=${this.onDragstartColumnOrder}
                          @dragend=${this.onDragendColumnOrder}
                        >
                          ${columnType}
                        </div>
                      `
                  )}
                </td>
              </tr>
            </tbody>
          </table>
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
    if (!el.closest(".vuerd-setting")) {
      this.onClose();
    }
  };
  private onDragoverGroupColumnOrder = (targetColumnType: ColumnType) => {
    const { store } = this.context;
    if (this.currentColumnType && this.currentColumnType !== targetColumnType) {
      this.flipAnimation.snapshot();
      store.dispatch(moveColumnOrder(this.currentColumnType, targetColumnType));
    }
  };
  private onDragoverColumnOrder = (event: DragEvent) => {
    const el = event.target as HTMLElement;
    const target = el.closest(".vuerd-column-order") as HTMLElement | null;
    if (target) {
      const columnType = el.dataset.id as ColumnType;
      this.draggable$.next(columnType);
    }
  };

  private onChangeRelationshipDataTypeSync(event: Event) {
    const { store } = this.context;
    const input = event.target as HTMLInputElement;
    store.dispatch(changeRelationshipDataTypeSync(input.checked));
  }
  private onDragstartColumnOrder(event: DragEvent) {
    const el = event.target as HTMLElement;
    const nodeList = this.renderRoot.querySelectorAll(".vuerd-column-order");
    nodeList.forEach((node) => {
      node.classList.add("none-hover");
      this.subDraggable.push(
        fromEvent<DragEvent>(node, "dragover")
          .pipe(throttleTime(300))
          .subscribe(this.onDragoverColumnOrder)
      );
    });
    this.currentColumnType = el.dataset.id as ColumnType;
  }
  private onDragendColumnOrder() {
    this.currentColumnType = null;
    this.subDraggable.forEach((sub) => sub.unsubscribe);
    this.subDraggable = [];
    this.renderRoot
      .querySelectorAll(".vuerd-column-order")
      .forEach((node) => node.classList.remove("none-hover"));
  }
}
