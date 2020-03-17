import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { Subscription } from "rxjs";
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

  private subKeydown!: Subscription;

  get theme() {
    const { font, canvas } = this.context.theme;
    return {
      color: font,
      backgroundColor: canvas,
      width: `${this.width}px`,
      height: `${this.height}px`
    };
  }

  connectedCallback() {
    super.connectedCallback();
    console.log("Editor before render");
    this.context = createEditorContext();
    if (process.env.NODE_ENV === "development") {
      this.subKeydown = this.context.windowEventObservable.keydown$.subscribe(
        event => {
          console.log(`
          metaKey: ${event.metaKey},
          ctrlKey: ${event.ctrlKey},
          altKey: ${event.altKey},
          shiftKey: ${event.shiftKey},
          code: ${event.code},
          key: ${event.key}
          `);
        }
      );
    }
  }
  firstUpdated() {
    console.log("Editor after render");
  }
  updated(changedProperties: any) {
    changedProperties.forEach((oldValue: any, propName: string) => {
      switch (propName) {
        case "width":
          console.log(`width: ${this.width}`);
          break;
        case "height":
          console.log(`height: ${this.height}`);
          break;
      }
    });
  }
  disconnectedCallback() {
    console.log("Editor destroy");
    this.context.store.destroy();
    if (process.env.NODE_ENV === "development") {
      this.subKeydown.unsubscribe();
    }
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
          .context=${this.context}
          .width=${this.width}
          .height=${this.height}
        ></vuerd-erd>
      </div>
    `;
  }

  focus() {
    this.context.store.editorState.focus = true;
  }
  blur() {
    this.context.store.editorState.focus = false;
  }
}
