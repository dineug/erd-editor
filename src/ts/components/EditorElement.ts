import { LitElement } from "lit-element";
import { EditorContext } from "@src/core/EditorContext";
import { Editor } from "@src/types";

export class EditorElement extends LitElement {
  context!: EditorContext;

  connectedCallback() {
    super.connectedCallback();
    // instance context injection
    const root = this.getRootNode() as ShadowRoot;
    const editor = root.host as Editor;
    this.context = editor.context;
  }

  protected createRenderRoot(): Element | ShadowRoot {
    return this;
  }
}
