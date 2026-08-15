import { TEMPLATE_LITERALS } from '@/constants';
import type { CompileMode, FlatRule } from '@/css';
// Type-only, and therefore erased: `cssSource.ts` imports `CSS_SOURCE` back at runtime.
import type { Slot } from '@/template/cssSource';
import { TNode } from '@/template/tNode';

export enum TemplateLiteralsType {
  html = 'html',
  svg = 'svg',
  css = 'css',
}

export const TemplateLiteralsTypes = new Set(
  Object.values(TemplateLiteralsType)
);

/**
 * The fully resolved css source of one literal instance — every slot already substituted, no
 * marker left. A nested literal is read through this key when it is spliced into its parent.
 */
export const CSS_SOURCE = Symbol.for(
  'https://github.com/dineug/r-html#CSSSource'
);

interface TL {
  strings: TemplateStringsArray;
  values: any[];
}

export interface DOMTemplateLiterals extends TL {
  [TEMPLATE_LITERALS]: TemplateLiteralsType.html | TemplateLiteralsType.svg;
  template: Template;
}

export interface CSSTemplateLiterals extends TL {
  [TEMPLATE_LITERALS]: TemplateLiteralsType.css;
  [CSS_SOURCE]: string;
  template: CSSTemplate;
  toString(): string;
}

export type TemplateLiterals = DOMTemplateLiterals | CSSTemplateLiterals;

export interface Template {
  node: TNode;
}

/** L2 entry: everything one set of slot values compiles to. */
export interface Compiled {
  /** The substituted source the compiler was handed. */
  source: string;
  /**
   * Copied off the node so the compiled artifact is self-describing: `vCSSStyleSheet.ts` buckets
   * by this and never has to be told which tag produced the sheet.
   */
  mode: CompileMode;
  rules: FlatRule[];
  /** Serialized with the scope sentinel still in place — the hash input. */
  canonicalText: string;
  identifier: string;
  cssText: string;
}

/**
 * Slot classification is value independent, so it is cached with the strings array; only the
 * compiled output depends on the values, and that is what `memo` holds.
 */
export interface CSSTemplateNode {
  raw: readonly string[];
  slots: Slot[];
  mode: CompileMode;
  memo: Map<string, Compiled>;
}

export interface CSSTemplate {
  node: CSSTemplateNode;
}

export const templateCache = new WeakMap<TemplateStringsArray, Template>();
export const cssTemplateCache = new WeakMap<
  TemplateStringsArray,
  CSSTemplate
>();
