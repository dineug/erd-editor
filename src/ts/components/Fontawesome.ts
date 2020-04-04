import { svg, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { EditorElement } from "./EditorElement";
import { Logger } from "@src/core/Logger";
import { getIcon } from "@src/plugins/fontawesome";

const SIZE = 24;
const SIZE_REM = 1.5;

@customElement("vuerd-fontawesome")
class Fontawesome extends EditorElement {
  @property({ type: String })
  prefix = "fas";
  @property({ type: String })
  icon = "";
  @property({ type: Number })
  size = SIZE;
  @property({ type: String })
  color = "";

  get theme() {
    const rem = SIZE_REM * (this.size / SIZE);
    return {
      display: "flex",
      width: `${rem}rem`,
      height: `${rem}rem`,
    };
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.color === "") {
      const { font } = this.context.theme;
      this.color = font;
    }
  }

  render() {
    const icon = getIcon(this.prefix, this.icon);
    if (icon) {
      const [width, height, , , d] = icon.icon;
      return svg`
        <svg style=${styleMap(this.theme)} viewBox="0 0 ${width} ${height}">
          <path d=${d} fill=${this.color}></path>
        </svg>
      `;
    } else {
      return svg``;
    }
  }
}
