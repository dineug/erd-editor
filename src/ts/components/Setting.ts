import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { fromEvent } from "rxjs";
import { EditorElement } from "./EditorElement";
import { Logger } from "@src/core/Logger";
import { defaultWidth } from "./Layout";
import { AnimationFrame } from "@src/core/Animation";
import { Bus } from "@src/core/Event";
import { keymapOptionToString } from "@src/core/Keymap";
import { changeRelationshipDataTypeSync } from "@src/core/command/canvas";

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
    const { mousedown$ } = this.context.windowEventObservable;
    const root = this.getRootNode() as ShadowRoot;
    const editor = root.querySelector(".vuerd-editor") as Element;
    this.subscriptionList.push(
      mousedown$.subscribe(this.onMousedownWindow),
      fromEvent<MouseEvent>(editor, "mousedown").subscribe(this.onMousedown),
      eventBus.on(Bus.Setting.close).subscribe(this.onClose),
      store.observe(store.canvasState.setting, (name) => {
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

  private onChangeRelationshipDataTypeSync(event: Event) {
    const { store } = this.context;
    const input = event.target as HTMLInputElement;
    store.dispatch(changeRelationshipDataTypeSync(input.checked));
  }
}
