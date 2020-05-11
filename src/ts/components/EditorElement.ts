import { LitElement } from "lit-element";
import { EditorContext } from "@src/core/EditorContext";

export class EditorElement extends LitElement {
  context!: EditorContext;

  connectedCallback() {
    super.connectedCallback();
    // instance context injection
    const root = this.getRootNode() as ShadowRoot;
    const editor = root.host as any;
    this.context = editor.context as EditorContext;
    // cache update
    this.requestUpdate();
  }

  protected createRenderRoot(): Element | ShadowRoot {
    return this;
  }
}
