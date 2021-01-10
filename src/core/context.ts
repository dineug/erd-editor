import { html } from "lit-html";
import { defineComponent } from "./defineComponent";
import { closestElement } from "./helper";

interface ProviderElement extends HTMLElement {
  value: any;
}

defineComponent("vuerd-provider", {
  shadow: { mode: "open" },
  render: () => () => html`<slot></slot>`,
});

declare global {
  interface HTMLElementTagNameMap {
    "vuerd-provider": ProviderElement;
  }
}

export function getContext<T = any>(el: Element): T {
  const provider = closestElement("vuerd-provider", el) as ProviderElement;
  return provider.value;
}
