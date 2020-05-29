import { LitElement, TemplateResult } from "lit-element";
import { Subscription } from "rxjs";
import { EditorContext } from "@src/core/EditorContext";
import { observeStart, observeEnd, destroyRef } from "@src/core/Observable";

export class RxElement extends LitElement {
  protected subscriptionList: Subscription[] = [];

  disconnectedCallback() {
    this.subscriptionList.forEach((subscription) => subscription.unsubscribe());
    this.subscriptionList = [];
    super.disconnectedCallback();
  }
}

export class EditorElement extends RxElement {
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

export abstract class ObservableElement extends EditorElement {
  protected abstract render$(): TemplateResult;
  protected render() {
    this.updateComplete.then(() => observeEnd());
    return observeStart(
      this,
      () => this.render$(),
      () => this.requestUpdate()
    );
  }
  disconnectedCallback() {
    destroyRef(this);
    super.disconnectedCallback();
  }
}
