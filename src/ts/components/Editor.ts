import { html, css, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { EditorElement } from "./EditorElement";
import { createEditorContext } from "@src/model/EditorContext";
import "./ERD";

@customElement("erd-editor")
class Editor extends EditorElement {
  static get styles() {
    return css`
      .vuerd-editor {
        position: relative;
        overflow: hidden;
      }
    `;
  }

  @property({ type: Number })
  width = 1200;
  @property({ type: Number })
  height = 675;

  get theme() {
    const { font, canvas } = this.context.theme;
    return {
      color: font,
      backgroundColor: canvas,
      width: `${this.width}px`,
      height: `${this.height}px`
    };
  }

  constructor() {
    super();
    console.log("constructor");
    this.context = createEditorContext();
  }
  connectedCallback() {
    super.connectedCallback();
    console.log("before render");
  }
  firstUpdated() {
    console.log("after render");
    // console.log(this.renderRoot.querySelector(".vuerd-editor"));
  }
  updated(changedProperties: any) {
    changedProperties.forEach((oldValue: any, propName: string) => {
      if (propName === "width" || propName === "height") {
        console.log(
          `${propName} changed. newValue: ${this[propName]}, oldValue: ${oldValue}`
        );
      }
    });
  }
  disconnectedCallback() {
    console.log("destroy");
    super.disconnectedCallback();
  }

  render() {
    return html`
      <div class="vuerd-editor" style=${styleMap(this.theme)}>
        <vuerd-erd
          .width=${this.width}
          .height=${this.height}
          .context=${this.context}
        ></vuerd-erd>
      </div>
    `;
  }
}
