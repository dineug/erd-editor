import { svg, css, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { repeat } from "lit-html/directives/repeat";
import { EditorElement } from "./EditorElement";

@customElement("vuerd-canvas-svg")
class CanvasSVG extends EditorElement {
  static get styles() {
    return css`
      .vuerd-canvas-svg {
        position: absolute;
        z-index: 1;
      }
    `;
  }

  get theme() {
    const { width, height } = this.context.canvas;
    return {
      width: `${width}px`,
      height: `${height}px`
    };
  }

  render() {
    return svg`
      <svg class="vuerd-canvas-svg" style=${styleMap(this.theme)}>
      ${repeat(
        [1, 2, 3],
        item => item,
        (item, index) => svg`
          <g></g>
        `
      )}
      </svg>
    `;
  }
}
