import type { FunctionalComponent } from '@/render/part/node/component/observableComponent';
import type { CSSTemplateLiterals, DOMTemplateLiterals } from '@/template';

export type Falsy = false | null | undefined;

/** What toClassList walks; a falsy entry is skipped at any depth. */
export type ClassValue =
  | string
  | number
  | CSSTemplateLiterals
  | Record<string, unknown>
  | readonly ClassValue[]
  | Falsy;

/** styleCommit writes each entry with setProperty, so keys stay kebab-case. */
export type StyleValue = Record<string, string | number | Falsy>;

/**
 * JSX rejects a repeated attribute, but r-html keeps every listener bound to one
 * event name, so a numbered suffix the transform strips is the escape hatch.
 * Spelt out rather than an index signature, which keeps a typo a type error.
 */
export type DuplicateSuffix = '' | '__2' | '__3';

/**
 * EventPart keeps only a function or a [handler, options] tuple and drops
 * everything else, so a conditional binding can hand it null rather than the
 * component splitting its template in two.
 */
export type EventHandler<E> =
  | ((event: E) => void)
  | readonly [
      (event: E) => void,
      (undefined | boolean | AddEventListenerOptions | EventListenerOptions)?,
    ]
  | Falsy;

export type EventHandlers<M> = {
  [K in keyof M as `on:${string & K}${DuplicateSuffix}`]?: EventHandler<M[K]>;
};

/** The three sigils the transform maps onto r-html's attribute kinds. */
export interface Sigils {
  /** ?name — coerced with isTruthy, so not restricted to booleans. */
  [bool: `bool:${string}`]: unknown;
  /** .name — set as a DOM property rather than an attribute. */
  [prop: `prop:${string}`]: unknown;
  /** A bare marker in attribute position: ref, and any other directive. */
  [use: `use:${string}`]: unknown;
}

export interface DatasetAttributes {
  [data: `data-${string}`]: string | number | boolean | Falsy;
  [aria: `aria-${string}`]: string | number | boolean | Falsy;
}

export interface CommonAttributes extends Sigils, DatasetAttributes {
  /**
   * Deliberately unknown: a text position accepts primitives, templates,
   * arrays, nodes, functions and directives, and getPartType picks a Part for
   * whatever turns up. Components are stricter, typed by their children prop.
   */
  children?: unknown;
  class?: ClassValue;
  style?: StyleValue;
  id?: string;
  title?: string;
}

export interface HTMLAttributes
  extends CommonAttributes, EventHandlers<HTMLElementEventMap> {
  /** Global, and enumerated: the values are the strings. */
  autocapitalize?: 'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters';
  /** Enumerated, like spellcheck: the values are the strings. */
  draggable?: boolean | 'true' | 'false';
  hidden?: boolean;
  /** Global, and enumerated: none keeps a focusable field from raising a keyboard. */
  inputmode?:
    | 'none'
    | 'text'
    | 'decimal'
    | 'numeric'
    | 'tel'
    | 'search'
    | 'email'
    | 'url';
  role?: string;
  /** An enumerated attribute, not a boolean one: the values are the strings. */
  spellcheck?: boolean | 'true' | 'false';
  /** An attribute value is a string; tabindex="-1" is the usual spelling. */
  tabindex?: number | `${number}`;
}

export interface SVGAttributes
  extends CommonAttributes, EventHandlers<SVGElementEventMap> {
  fill?: string;
  'fill-opacity'?: number | string;
  opacity?: number | string;
  stroke?: string;
  'stroke-dasharray'?: number | string;
  'stroke-linecap'?: 'butt' | 'round' | 'square';
  'stroke-linejoin'?: 'arcs' | 'bevel' | 'miter' | 'miter-clip' | 'round';
  'stroke-opacity'?: number | string;
  'stroke-width'?: number | string;
  transform?: string;
}

export interface ButtonAttributes extends HTMLAttributes {
  disabled?: boolean;
  name?: string;
  type?: 'button' | 'reset' | 'submit';
  value?: string;
}

export interface ImgAttributes extends HTMLAttributes {
  alt?: string;
  height?: number | string;
  loading?: 'eager' | 'lazy';
  src?: string;
  width?: number | string;
}

export interface InputAttributes extends HTMLAttributes {
  autocomplete?: string;
  checked?: boolean;
  disabled?: boolean;
  max?: number | string;
  maxlength?: number;
  min?: number | string;
  name?: string;
  placeholder?: string;
  readonly?: boolean;
  step?: number | string;
  type?: string;
  value?: number | string;
}

export interface TextareaAttributes extends HTMLAttributes {
  autocomplete?: string;
  /** WebKit's, and enumerated: the values are the strings. */
  autocorrect?: 'on' | 'off';
  cols?: number;
  disabled?: boolean;
  name?: string;
  placeholder?: string;
  readonly?: boolean;
  rows?: number;
  value?: string;
}

export interface TableCellAttributes extends HTMLAttributes {
  colspan?: number;
  rowspan?: number;
}

export interface SvgRootAttributes extends SVGAttributes {
  height?: number | string;
  preserveAspectRatio?: string;
  viewBox?: string;
  width?: number | string;
  xmlns?: string;
}

export interface LineAttributes extends SVGAttributes {
  x1?: number | string;
  x2?: number | string;
  y1?: number | string;
  y2?: number | string;
}

export interface CircleAttributes extends SVGAttributes {
  cx?: number | string;
  cy?: number | string;
  r?: number | string;
}

export interface RectAttributes extends SVGAttributes {
  height?: number | string;
  rx?: number | string;
  ry?: number | string;
  width?: number | string;
  x?: number | string;
  y?: number | string;
}

export interface PathAttributes extends SVGAttributes {
  d?: string;
}

export interface EllipseAttributes extends SVGAttributes {
  cx?: number | string;
  cy?: number | string;
  rx?: number | string;
  ry?: number | string;
}

export interface PolyAttributes extends SVGAttributes {
  points?: string;
}

type IntrinsicHTMLElements = {
  [Tag in keyof HTMLElementTagNameMap]: HTMLAttributes;
};

type IntrinsicSVGElements = {
  [Tag in Exclude<
    keyof SVGElementTagNameMap,
    keyof HTMLElementTagNameMap
  >]: SVGAttributes;
};

export declare namespace JSX {
  type ElementType = string | FunctionalComponent<any, any>;

  interface Element extends DOMTemplateLiterals {}

  interface ElementChildrenAttribute {
    children: {};
  }

  interface IntrinsicAttributes {}

  /**
   * Every standard tag, read from the DOM lib rather than listed by hand, with
   * SVG contributing only the names HTML does not define — the transform
   * resolves the overlap the same way. No index signature: a typo is a typo.
   */
  interface IntrinsicElements
    extends IntrinsicHTMLElements, IntrinsicSVGElements {
    // Element-specific attributes, layered over the generic map. Each is a
    // subtype of what it overrides, so the two stay assignable.
    button: ButtonAttributes;
    circle: CircleAttributes;
    ellipse: EllipseAttributes;
    img: ImgAttributes;
    input: InputAttributes;
    line: LineAttributes;
    path: PathAttributes;
    polygon: PolyAttributes;
    polyline: PolyAttributes;
    rect: RectAttributes;
    svg: SvgRootAttributes;
    td: TableCellAttributes;
    textarea: TextareaAttributes;
    th: TableCellAttributes;
  }
}
