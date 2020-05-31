import { html, customElement } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { EditorElement } from "@src/components/EditorElement";
import { Logger } from "@src/core/Logger";
import { UserMouse } from "@src/core/store/Share";

@customElement("vuerd-share-mouse")
class ShareMouse extends EditorElement {
  userMouse!: UserMouse;

  connectedCallback() {
    super.connectedCallback();
    const { store } = this.context;
    this.subscriptionList.push(
      store.observe(this.userMouse, () => this.requestUpdate())
    );
  }

  render() {
    return html`
      <div
        class="vuerd-share-mouse"
        style=${styleMap({
          top: `${this.userMouse.y}px`,
          left: `${this.userMouse.x}px`,
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
