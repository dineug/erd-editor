import { SVGTemplateResult, TemplateResult } from 'lit-html';

export type Callback = () => void;
export type Template = () =>
  | TemplateResult
  | SVGTemplateResult
  | null
  | undefined;
export type FunctionalComponent<P = any, T = HTMLElement> = (
  this: HTMLElement,
  props: P,
  ctx: T
) => Template;
export type PrimitiveType = string | number | boolean | null | undefined;
export type Convert = (value: string | null) => PrimitiveType;

export interface PropOptions {
  name: string;
  default?: PrimitiveType;
  // attribute convert type
  type?: Convert | typeof String | typeof Number | typeof Boolean;
}

export interface Options {
  observedProps?: Array<string | PropOptions>;
  shadow?: ShadowRootMode | false;
  style?: string;
  styleMap?: Partial<CSSStyleDeclaration>;
  render: FunctionalComponent<any, any>;
}

export interface Ref<T> {
  value: T;
}

export declare function beforeMount(callback: Callback): void;
export declare function mounted(callback: Callback): void;
export declare function unmounted(callback: Callback): void;
export declare function beforeFirstUpdate(callback: Callback): void;
export declare function firstUpdated(callback: Callback): void;
export declare function beforeUpdate(callback: Callback): void;
export declare function updated(callback: Callback): void;
export declare function query<T = any>(selector: string): Ref<T>;
export declare function queryAll<T = any>(selector: string): Ref<T>;
export declare function queryShadow<T = any>(...selectors: string[]): Ref<T>;
export declare function queryShadowAll<T = any>(...selectors: string[]): Ref<T>;
export declare function defineComponent(name: string, options: Options): void;
