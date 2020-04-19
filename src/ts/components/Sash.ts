import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { classMap } from "lit-html/directives/class-map";
import { EditorElement } from "./EditorElement";
import { Logger } from "@src/core/Logger";
import { SIZE_SASH } from "@src/core/Layout";

@customElement("vuerd-sash")
class Sash extends EditorElement {
  @property({ type: Boolean })
  vertical = false;
  @property({ type: Boolean })
  horizontal = false;
  @property({ type: Boolean })
  edge = false;
  @property({ type: String })
  cursor = "default";
  @property({ type: Number })
  top = 0;
  @property({ type: Number })
  left = 0;

  get classMap() {
    const classMap: any = {
      "vuerd-sash": true,
    };
    if (this.vertical) {
      classMap.vertical = true;
    } else if (this.horizontal) {
      classMap.horizontal = true;
    } else if (this.edge) {
      classMap.edge = true;
    }
    return classMap;
  }

  get styleMap() {
    const theme: any = {
      top: `${this.centerTop}px`,
      left: `${this.centerLeft}px`,
    };
    if (this.edge) {
      theme.cursor = this.cursor;
    }
    return theme;
  }

  get centerTop() {
    return this.top === 0 && !this.horizontal && !this.edge
      ? this.top
      : this.top - SIZE_SASH / 2;
  }

  get centerLeft() {
    return this.left === 0 && !this.vertical && !this.edge
      ? this.left
      : this.left - SIZE_SASH / 2;
  }

  render() {
    return html`
      <div
        class=${classMap(this.classMap)}
        style=${styleMap(this.styleMap)}
      ></div>
    `;
  }
}
