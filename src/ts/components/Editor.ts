import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { EditorElement } from "./EditorElement";
import { createEditorContext } from "@src/core/EditorContext";
import { Layout, defaultWidth, defaultHeight } from "./Layout";
import "./ERD";
import "./Fontawesome";
import "./Contextmenu";

@customElement("erd-editor")
class Editor extends EditorElement {
  static get styles() {
    return Layout;
  }

  @property({ type: Number })
  width = defaultWidth;
  @property({ type: Number })
  height = defaultHeight;

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
    console.log("Editor constructor");
    this.context = createEditorContext();
  }
  connectedCallback() {
    super.connectedCallback();
    console.log("Editor before render");
  }
  firstUpdated() {
    console.log("Editor after render");
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
    console.log("Editor destroy");
    super.disconnectedCallback();
  }

  protected createRenderRoot(): Element | ShadowRoot {
    return this.attachShadow({ mode: "open" });
  }

  render() {
    console.log("Editor render");
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
