import { closestElement } from "./helper";

export interface ProviderElement<T> extends HTMLElement {
  value: T;
}

export function getContext<T = any>(selector: string, el: Element): T {
  const provider = closestElement(selector, el) as ProviderElement<T>;
  return provider.value;
}
