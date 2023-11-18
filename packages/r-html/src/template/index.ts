import { TEMPLATE_LITERALS } from '@/constants';
import { TCNode } from '@/template/tcNode';
import { TNode } from '@/template/tNode';

export enum TemplateLiteralsType {
  html = 'html',
  svg = 'svg',
  css = 'css',
}

export const TemplateLiteralsTypes = new Set(
  Object.values(TemplateLiteralsType)
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
  template: CSSTemplate;
  toString(): string;
}

export type TemplateLiterals = DOMTemplateLiterals | CSSTemplateLiterals;

export interface Template {
  node: TNode;
}

export interface CSSTemplate {
  node: TCNode;
}

export const templateCache = new WeakMap<TemplateStringsArray, Template>();
export const cssTemplateCache = new WeakMap<
  TemplateStringsArray,
  CSSTemplate
>();
