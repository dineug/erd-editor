import { svg, customElement } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { repeat } from "lit-html/directives/repeat";
import { Subscription } from "rxjs";
import { EditorElement } from "../EditorElement";
import { Logger } from "@src/core/Logger";

@customElement("vuerd-canvas-svg")
class CanvasSVG extends EditorElement {
  private subscriptionList: Subscription[] = [];

  connectedCallback() {
    super.connectedCallback();
    Logger.debug("CanvasSVG before render");
    const { store } = this.context;
    this.subscriptionList.push(
      store.observe(store.canvasState, (name) => {
        switch (name) {
          case "width":
          case "height":
            this.requestUpdate();
            break;
        }
      })
    );
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
        (item) => item,
        (item, index) => svg`
          <g></g>
        `
      )}
      </svg>
    `;
  }
}
