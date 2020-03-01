import { html, css, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { repeat } from "lit-html/directives/repeat";
import { EditorElement } from "./EditorElement";
import "./Table";
import "./CanvasSVG";

@customElement("vuerd-canvas")
class Canvas extends EditorElement {
  static get styles() {
    return css`
      .vuerd-canvas {
        position: relative;
      }

      .vuerd-canvas-svg {
        position: absolute;
        z-index: 1;
      }
    `;
  }

  get theme() {
    const { canvas } = this.context.theme;
    const { width, height } = this.context.canvas;
    return {
      backgroundColor: canvas,
      width: `${width}px`,
      height: `${height}px`
    };
  }

  render() {
    return html`
      <div class="vuerd-canvas" style=${styleMap(this.theme)}>
        ${repeat(
          [1, 2, 3],
          item => item,
          (item, index) => html`
            <vuerd-table .context=${this.context}></vuerd-table>
          `
        )}
        <vuerd-canvas-svg .context=${this.context}></vuerd-canvas-svg>
      </div>
    `;
  }
}
