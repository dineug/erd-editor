import { LitElement, html, css, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { createEditorContext } from "@src/model/EditorContext";

@customElement("erd-editor")
class Editor extends LitElement {
  static get styles() {
    return css`
      .vuerd-editor {
        position: relative;
        overflow: hidden;
      }
    `;
  }

  @property({ type: Number })
  width = 2000;
  @property({ type: Number })
  height = 2000;

  private context = createEditorContext();

  get theme() {
    const { font, canvas } = this.context.theme;
    const { width, height } = this;
    return {
      color: font,
      backgroundColor: canvas,
      width: `${width}px`,
      height: `${height}px`
    };
  }

  constructor() {
    super();
    console.log("constructor");
  }
  connectedCallback() {
    super.connectedCallback();
    console.log("before render");
  }
  firstUpdated() {
    console.log("after render");
    console.log(this.renderRoot.querySelector(".vuerd-editor"));
  }
  updated(changedProperties: any) {
    console.log("updated", changedProperties);
  }
  disconnectedCallback() {
    console.log("before destroy");
    super.disconnectedCallback();
  }

  render() {
    return html`
      <div class="vuerd-editor" style=${styleMap(this.theme)}>
        Editor
      </div>
    `;
  }
}
