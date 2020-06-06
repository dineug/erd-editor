import { svg, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { EditorElement } from "./EditorElement";
import { Logger } from "@src/core/Logger";
import { getIcon } from "@src/core/Icon";

const SIZE = 24;
const SIZE_REM = 1.5;

@customElement("vuerd-icon")
class Icon extends EditorElement {
  @property({ type: String })
  prefix = "fas";
  @property({ type: String })
  icon = "";
  @property({ type: Number })
  size = SIZE;
  @property({ type: String })
  color = "";

  render() {
    const icon = getIcon(this.prefix, this.icon);
    if (icon) {
      const [width, height, , , d] = icon.icon;
      const rem = SIZE_REM * (this.size / SIZE);
      return svg`
        <svg
          class="vuerd-icon"
          style=${styleMap({
            display: "inline-flex",
            width: `${rem}rem`,
            height: `${rem}rem`,
          })} 
          viewBox="0 0 ${width} ${height}"
        >
          ${
            this.color === ""
              ? svg`<path d=${d}></path>`
              : svg`<path d=${d} fill=${this.color}></path>`
          }
        </svg>
      `;
    } else {
      return svg``;
    }
  }
}
