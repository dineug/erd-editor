import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { classMap } from "lit-html/directives/class-map";
import { repeat } from "lit-html/directives/repeat";
import { Subject, fromEvent } from "rxjs";
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
import {
  draggableColumnOrder,
  draggableEndColumnOrder,
} from "@src/core/command/editor";

const MAX_WIDTH = 800;

@customElement("vuerd-setting")
class Setting extends EditorElement {
  @property({ type: Number })
  width = defaultWidth;
  @property({ type: Boolean })
  animation = true;
  @property({ type: Number })
  animationRight = defaultWidth;

  private animationFrame = new AnimationFrame<{ right: number }>(200);
  private flipAnimation = new FlipAnimation(
    this.renderRoot,
    ".vuerd-column-order",
    "vuerd-column-order-move"
  );
  private draggable$: Subject<ColumnType> = new Subject();
  private dragoverMap: { [key: string]: Subject<ColumnType> } = {
    columnName$: new Subject<ColumnType>(),
    columnDataType$: new Subject<ColumnType>(),
    columnNotNull$: new Subject<ColumnType>(),
    columnDefault$: new Subject<ColumnType>(),
    columnComment$: new Subject<ColumnType>(),
  };

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
    const { mousedown$ } = this.context.windowEventObservable;
    const root = this.getRootNode() as ShadowRoot;
    const editor = root.querySelector(".vuerd-editor") as Element;
    Object.keys(this.dragoverMap).forEach((key) =>
      this.subscriptionList.push(
        this.dragoverMap[key]
          .pipe(throttleTime(300))
          .subscribe(this.onDragoverGroupColumnOrder)
      )
    );
    this.subscriptionList.push(
      this.draggable$
        .pipe(debounceTime(50))
        .subscribe(this.onDragoverColumnOrder),
      mousedown$.subscribe(this.onMousedownWindow),
      fromEvent<MouseEvent>(editor, "mousedown").subscribe(this.onMousedown),
      eventBus.on(Bus.Setting.close).subscribe(this.onClose),
      store.observe(setting.columnOrder, () => this.requestUpdate()),
      store.observe(setting, (name) => {
        if (name === "relationshipDataTypeSync") {
          this.requestUpdate();
        }
      }),
      store.observe(store.editorState, (name) => {
        const { draggableColumnOrder } = store.editorState;
        if (name === "draggableColumnOrder") {
          if (!draggableColumnOrder) {
            this.requestUpdate();
          }
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
                <td>Column Order</td>
                <td>
                  ${repeat(
                    setting.columnOrder,
                    (columnType) => columnType,
                    (columnType) =>
                      html`
                        <div
                          class=${classMap({
                            "vuerd-column-order": true,
                            draggable: this.draggableColumnOrder(columnType),
                          })}
                          data-id=${columnType}
                          draggable="true"
                          @dragstart=${this.onDragstartColumnOrder}
                          @dragend=${this.onDragendColumnOrder}
                          @dragover=${this.onDragoverTargetColumnOrder}
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
  private onMousedownWindow = (event: MouseEvent) => {
    const { user } = this.context.store;
    const el = event.target as HTMLElement;
    const root = this.getRootNode() as ShadowRoot;
    const target = el.closest(root.host.localName) as any;
    if (!target || user.id !== target?.context?.store?.user?.id) {
      this.onClose();
    }
  };
  private onDragoverGroupColumnOrder = (targetColumnType: ColumnType) => {
    this.draggable$.next(targetColumnType);
  };
  private onDragoverColumnOrder = (targetColumnType: ColumnType) => {
    const { store } = this.context;
    const { draggableColumnOrder } = store.editorState;
    if (
      draggableColumnOrder !== null &&
      draggableColumnOrder.columnType !== targetColumnType
    ) {
      this.flipAnimation.snapshot();
      store.dispatch(
        moveColumnOrder(draggableColumnOrder.columnType, targetColumnType)
      );
    }
  };

  private onChangeRelationshipDataTypeSync(event: Event) {
    const { store } = this.context;
    const input = event.target as HTMLInputElement;
    store.dispatch(changeRelationshipDataTypeSync(input.checked));
  }
  private onDragstartColumnOrder(event: DragEvent) {
    const { store } = this.context;
    const el = event.target as HTMLElement;
    this.renderRoot
      .querySelectorAll(".vuerd-column-order")
      .forEach((node) => node.classList.add("none-hover"));
    store.dispatch(draggableColumnOrder(el.dataset.id as ColumnType));
  }
  private onDragendColumnOrder(event: DragEvent) {
    const { store } = this.context;
    this.renderRoot
      .querySelectorAll(".vuerd-column-order")
      .forEach((node) => node.classList.remove("none-hover"));
    store.dispatch(draggableEndColumnOrder());
  }
  private onDragoverTargetColumnOrder(event: DragEvent) {
    const el = event.target as HTMLElement;
    const targetColumnType = el.dataset.id as ColumnType;
    this.dragoverMap[`${targetColumnType}$`].next(targetColumnType);
  }

  private draggableColumnOrder(columnType: ColumnType) {
    const { draggableColumnOrder } = this.context.store.editorState;
    return (
      draggableColumnOrder !== null &&
      draggableColumnOrder.columnType === columnType
    );
  }
}
