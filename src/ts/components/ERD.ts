import { html, css, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { EditorElement } from "./EditorElement";
import "./Canvas";

@customElement("vuerd-erd")
class ERD extends EditorElement {
  static get styles() {
    return css`
      .vuerd-erd {
        position: relative;
        overflow: hidden;
      }
    `;
  }

  @property({ type: Number })
  width = 2000;
  @property({ type: Number })
  height = 2000;

  get theme() {
    return {
      width: `${this.width}px`,
      height: `${this.height}px`
    };
  }

  render() {
    return html`
      <div class="vuerd-erd" style=${styleMap(this.theme)}>
        <vuerd-canvas .context=${this.context}></vuerd-canvas>
      </div>
    `;
  }
}
