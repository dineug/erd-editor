import { Options } from '@@types/defineComponent';

const supportsAdoptingStyleSheets =
  window.ShadowRoot &&
  'adoptedStyleSheets' in Document.prototype &&
  'replace' in CSSStyleSheet.prototype;

export const isSheet = (options: Options): boolean =>
  supportsAdoptingStyleSheets && !!options.shadow && !!options.style;

export const isStyle = (options: Options): boolean =>
  !isSheet(options) && !!options.style;
