import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { EditorElement } from "./EditorElement";
import { Logger } from "@src/core/Logger";

@customElement("vuerd-circle-button")
class CircleButton extends EditorElement {
  @property({ type: String })
  icon = "";
  @property({ type: String })
  color = "";
  @property({ type: String })
  backgroundColor = "";
  @property({ type: String })
  title = "";

  get theme() {
    return {
      backgroundColor: this.backgroundColor,
    };
  }

  render() {
    return html`
      <div
        class="vuerd-circle-button"
        style=${styleMap(this.theme)}
        .title=${this.title}
        @mouseenter=${this.onMouseenter}
        @mouseleave=${this.onMouseleave}
      >
        <vuerd-fontawesome
          .context=${this.context}
          .icon=${this.icon}
          .color=${this.color}
          size="7"
        >
        </vuerd-fontawesome>
      </div>
    `;
  }

  private onMouseenter = (event: MouseEvent) => {
    const { fontActive } = this.context.theme;
    this.color = fontActive;
  };
  private onMouseleave = (event: MouseEvent) => {
    this.color = this.backgroundColor;
  };
}
