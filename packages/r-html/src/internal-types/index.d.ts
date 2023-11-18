interface ShadowRoot {
  adoptedStyleSheets: CSSStyleSheet[];
}

interface Document {
  adoptedStyleSheets: CSSStyleSheet[];
}

interface CSSStyleSheet {
  replaceSync(cssText: string): void;
  replace(cssText: string): Promise<unknown>;
}
