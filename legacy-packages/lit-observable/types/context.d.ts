export interface ProviderElement<T> extends HTMLElement {
  value: T;
}

export declare function getContext<T = any>(selector: string, el: Element): T;
