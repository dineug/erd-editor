import { svg, customElement } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { repeat } from "lit-html/directives/repeat";
import { EditorElement } from "./EditorElement";
import { Logger } from "@src/core/Logger";

@customElement("vuerd-canvas-svg")
class CanvasSVG extends EditorElement {
  connectedCallback() {
    super.connectedCallback();
    Logger.debug("CanvasSVG before render");
  }
  disconnectedCallback() {
    Logger.debug("CanvasSVG destroy");
    super.disconnectedCallback();
  }

  render() {
    Logger.debug("CanvasSVG render");
    const { width, height } = this.context.store.canvasState;
    return svg`
      <svg 
        class="vuerd-canvas-svg" 
        style=${styleMap({
          width: `${width}px`,
          height: `${height}px`,
        })}
      >
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
