import { svg, customElement } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { repeat } from "lit-html/directives/repeat";
import { EditorElement } from "./EditorElement";
import { Logger } from "@src/core/Logger";

@customElement("vuerd-canvas-svg")
class CanvasSVG extends EditorElement {
  get theme() {
    const { width, height } = this.context.store.canvasState;
    return {
      width: `${width}px`,
      height: `${height}px`,
    };
  }

  connectedCallback() {
    super.connectedCallback();
    Logger.debug("CanvasSVG before render");
  }
  firstUpdated() {
    Logger.debug("CanvasSVG after render");
  }
  disconnectedCallback() {
    Logger.debug("CanvasSVG destroy");
    super.disconnectedCallback();
  }

  render() {
    Logger.debug("CanvasSVG render");
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
