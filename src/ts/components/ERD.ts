import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { EditorElement } from "./EditorElement";
import { defaultWidth, defaultHeight } from "./Layout";
import "./Canvas";

@customElement("vuerd-erd")
class ERD extends EditorElement {
  @property({ type: Number })
  width = defaultWidth;
  @property({ type: Number })
  height = defaultHeight;

  get theme() {
    return {
      width: `${this.width}px`,
      height: `${this.height}px`
    };
  }

  constructor() {
    super();
    console.log("ERD constructor");
  }
  connectedCallback() {
    super.connectedCallback();
    console.log("ERD before render");
  }
  firstUpdated() {
    console.log("ERD after render");
  }
  disconnectedCallback() {
    console.log("ERD destroy");
    super.disconnectedCallback();
  }

  render() {
    console.log("ERD render");
    return html`
      <div class="vuerd-erd" style=${styleMap(this.theme)}>
        <vuerd-canvas .context=${this.context}></vuerd-canvas>
      </div>
    `;
  }
}
