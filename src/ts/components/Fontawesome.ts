import { svg, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { EditorElement } from "./EditorElement";
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

  get theme() {
    const rem = SIZE_REM * (this.size / SIZE);
    return {
      verticalAlign: "middle",
      width: `${rem}rem`,
      height: `${rem}rem`
    };
  }

  render() {
    const icon = getIcon(this.prefix, this.icon);
    if (icon) {
      const [width, height, , , d] = icon.icon;
      const { font } = this.context.theme;
      return svg`
        <svg style=${styleMap(this.theme)} viewBox="0 0 ${width} ${height}">
          <path d=${d} fill=${font}></path>
        </svg>
      `;
    } else {
      return svg``;
    }
  }
}
