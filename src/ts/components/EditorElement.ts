import { LitElement } from "lit-element";
import { Subscription } from "rxjs";
import { EditorContext } from "@src/core/EditorContext";

export class EditorElement extends LitElement {
  protected context!: EditorContext;
  protected subscriptionList: Subscription[] = [];

  connectedCallback() {
    super.connectedCallback();
    // instance context injection
    const root = this.getRootNode() as ShadowRoot;
    const editor = root.host as any;
    this.context = editor.context as EditorContext;
    // cache update
    this.requestUpdate();
  }

  disconnectedCallback() {
    this.subscriptionList.forEach((subscription) => subscription.unsubscribe());
    this.subscriptionList = [];
    super.disconnectedCallback();
  }

  protected createRenderRoot(): Element | ShadowRoot {
    return this;
  }
}
