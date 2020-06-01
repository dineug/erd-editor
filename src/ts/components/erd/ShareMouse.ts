import { html, customElement } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { Subscription } from "rxjs";
import { EditorElement } from "@src/components/EditorElement";
import { Logger } from "@src/core/Logger";
import { UserMouse } from "@src/core/store/Share";

@customElement("vuerd-share-mouse")
class ShareMouse extends EditorElement {
  userMouse!: UserMouse;

  private x = 0;
  private y = 0;
  private subLerp: Subscription | null = null;

  connectedCallback() {
    super.connectedCallback();
    const { requestAnimationFrame$ } = this.context.windowEventObservable;
    this.x = this.userMouse.x;
    this.y = this.userMouse.y;
    this.subLerp = requestAnimationFrame$.subscribe(() => {
      this.x += (this.userMouse.x - this.x) * 0.2;
      this.y += (this.userMouse.y - this.y) * 0.2;
      this.requestUpdate();
    });
  }
  disconnectedCallback() {
    this.subLerp?.unsubscribe();
    super.disconnectedCallback();
  }

  render() {
    return html`
      <div
        class="vuerd-share-mouse"
        style=${styleMap({
          top: `${this.y}px`,
          left: `${this.x}px`,
        })}
      >
        <vuerd-icon
          icon="mouse-pointer"
          size="18"
          color=${this.userMouse.color}
        ></vuerd-icon>
        <span>${this.userMouse.name}</span>
      </div>
    `;
  }
}
