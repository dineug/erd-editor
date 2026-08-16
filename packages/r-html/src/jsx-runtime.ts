/**
 * The JSX contract for r-html, reached as `@dineug/r-html/jsx-runtime` through
 * `jsxImportSource`.
 *
 * Declarations only. Nothing here exists at run time and nothing should: the
 * transform in `@dineug/vite-plugin-r-html` rewrites every JSX tree into an
 * `html` / `svg` tagged template before the file reaches a JS transform, so no
 * `jsx()` call is ever emitted. The package's `exports` entry offers `types`
 * and no `default`, so a build that lost the plugin dies on an unresolvable
 * import at its first `.tsx` instead of rendering the wrong thing quietly.
 *
 * `IntrinsicElements` covers the standard tags. A consumer with custom elements
 * adds them by merging:
 *
 * ```ts
 * declare module '@dineug/r-html/jsx-runtime' {
 *   namespace JSX {
 *     interface IntrinsicElements {
 *       'my-element': HTMLAttributes;
 *     }
 *   }
 * }
 * ```
 */
import type { FunctionalComponent } from '@/render/part/node/component/observableComponent';
import type { DOMTemplateLiterals } from '@/template';

export type Falsy = false | null | undefined;

/**
 * What `toClassList` walks. Note the asymmetry this cannot express: a static
 * `class="a b"` becomes a `staticAttrs` entry and is written verbatim, but a
 * dynamic `class={value}` goes through `classCommit`, which returns early
 * unless the value is an object or an array — a bare string there is a silent
 * no-op, in tagged templates just as much as in JSX.
 */
export type ClassValue =
  | string
  | number
  | Record<string, unknown>
  | readonly ClassValue[]
  | Falsy;

/** `styleCommit` writes each entry with `setProperty`, so keys stay kebab-case. */
export type StyleValue = Record<string, string | number | Falsy>;

/**
 * JSX rejects a repeated attribute outright (TS17001), but r-html keeps every
 * listener bound to one event name — `tNode` groups events and `EventPart` adds
 * each separately, and the order is observable. `on:input__2` is the escape
 * hatch: the transform strips the suffix, so the second binding lands on
 * `@input` exactly like the first.
 *
 * Spelling the suffixes out rather than reaching for an `on:${string}` index
 * signature is what keeps `on:clik` a type error.
 */
export type DuplicateSuffix = '' | '__2' | '__3';

export type EventHandlers<M> = {
  [K in keyof M as `on:${string & K}${DuplicateSuffix}`]?: (
    event: M[K]
  ) => void;
};

/** The three sigils the transform maps onto r-html's attribute kinds. */
export interface Sigils {
  /** `?name` — coerced with `isTruthy`, so not restricted to booleans. */
  [bool: `bool:${string}`]: unknown;
  /** `.name` — set as a DOM property rather than an attribute. */
  [prop: `prop:${string}`]: unknown;
  /** A bare marker in attribute position: `ref`, and any other directive. */
  [use: `use:${string}`]: unknown;
}

export interface DatasetAttributes {
  [data: `data-${string}`]: string | number | boolean | Falsy;
  [aria: `aria-${string}`]: string | number | boolean | Falsy;
}

export interface CommonAttributes extends Sigils, DatasetAttributes {
  /**
   * Deliberately `unknown`: a text position accepts primitives, nested
   * templates, arrays, DOM nodes, functions and directives, and `getPartType`
   * picks a `Part` for whatever turns up. Components are stricter — their
   * children land on the `children` prop and are typed by it.
   */
  children?: unknown;
  class?: ClassValue;
  style?: StyleValue;
  id?: string;
  title?: string;
}

export interface HTMLAttributes
  extends CommonAttributes, EventHandlers<HTMLElementEventMap> {
  draggable?: boolean;
  hidden?: boolean;
  role?: string;
  spellcheck?: boolean;
  tabindex?: number;
}

export interface SVGAttributes
  extends CommonAttributes, EventHandlers<SVGElementEventMap> {
  fill?: string;
  'fill-opacity'?: number | string;
  opacity?: number | string;
  stroke?: string;
  'stroke-dasharray'?: number | string;
  'stroke-linecap'?: 'butt' | 'round' | 'square';
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
   * No `LibraryManagedAttributes` on purpose. A component's accepted attributes
   * are exactly the props it declares, so that is what hovering a tag shows and
   * what an error names.
   *
   * The alternative was grafting on an `on:${string}` index signature for the
   * `@event` binding routed to a component's event bus. It would sit on top of
   * every component's props — in completions and in every error message — to
   * type a binding whose payload no type here can know. Adding it back is a
   * deliberate act for whoever first needs it.
   */

  /**
   * Every standard tag, taken from the DOM lib rather than listed by hand:
   * `HTMLElementTagNameMap` and `SVGElementTagNameMap` already are that list,
   * and reading them keeps this in step with the TypeScript version in use.
   *
   * SVG contributes only the names HTML does not already define — `a`,
   * `script`, `style` and `title` exist in both, and HTML wins. Those four are
   * exactly the tags the transform refuses to infer a namespace for, so an SVG
   * one has to sit inside an `<svg>` root anyway, where the namespace comes
   * from the root and not from this map.
   *
   * There is deliberately no index signature: `<dvi>` is a typo, not an
   * element. Custom elements are added by merging — see the module doc above.
   */
  interface IntrinsicElements
    extends IntrinsicHTMLElements, IntrinsicSVGElements {
    // Element-specific attributes, layered over the generic map. Each is a
    // subtype of what it overrides, so the two stay assignable.
    button: ButtonAttributes;
    circle: CircleAttributes;
    img: ImgAttributes;
    input: InputAttributes;
    line: LineAttributes;
    path: PathAttributes;
    rect: RectAttributes;
    svg: SvgRootAttributes;
    td: TableCellAttributes;
    textarea: TextareaAttributes;
    th: TableCellAttributes;
  }
}
