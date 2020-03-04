import { svg, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { repeat } from "lit-html/directives/repeat";
import { EditorElement } from "../model/EditorElement";

@customElement("vuerd-canvas-svg")
class CanvasSVG extends EditorElement {
  get theme() {
    const { width, height } = this.context.store.canvasState;
    return {
      width: `${width}px`,
      height: `${height}px`
    };
  }

  constructor() {
    super();
    console.log("CanvasSVG constructor");
  }
  connectedCallback() {
    super.connectedCallback();
    console.log("CanvasSVG before render");
  }
  firstUpdated() {
    console.log("CanvasSVG after render");
  }
  disconnectedCallback() {
    console.log("CanvasSVG destroy");
    super.disconnectedCallback();
  }

  render() {
    console.log("CanvasSVG render");
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
