import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { classMap } from "lit-html/directives/class-map";
import { Subscription } from "rxjs";
import { EditorElement } from "@src/components/EditorElement";
import { Logger } from "@src/core/Logger";
import { SIZE_MEMO_PADDING } from "@src/core/Layout";
import { Memo as MemoModel } from "@src/core/store/Memo";

const MEMO_PADDING = SIZE_MEMO_PADDING * 2;
const MEMO_HEADER = 17 + SIZE_MEMO_PADDING;

@customElement("vuerd-minimap-memo")
class Memo extends EditorElement {
  memo!: MemoModel;

  private subscriptionList: Subscription[] = [];

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
  disconnectedCallback() {
    this.subscriptionList.forEach((sub) => sub.unsubscribe());
    super.disconnectedCallback();
  }

  render() {
    const { ui } = this.memo;
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
      ></div>
    `;
  }
}
