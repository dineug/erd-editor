/**
 * The JSX type layer for `@dineug/vite-plugin-r-html`'s transform.
 *
 * `jsxImportSource` names `@dineug/r-html` because that is whose contract these
 * describe, and `tsconfig.json` maps the `/jsx-runtime` subpath here. r-html
 * does not ship it yet — `vite-plugin-dts` emits no hand-written `.d.ts`, so
 * moving this there is its own piece of work. Everything below except the
 * `erd-editor` row is framework-level and would go with it.
 *
 * Declarations only, and nothing resolves them at run time. The transform
 * rewrites every JSX tree into an `html` / `svg` tagged template before
 * `vite:oxc` sees the file, so no `jsx()` call is ever emitted. If the plugin
 * goes missing, oxc's own transform runs and the build dies on
 * `@dineug/r-html/jsx-runtime` — the package exports no such subpath
 * (`ERR_PACKAGE_PATH_NOT_EXPORTED`) — loudly, at the first `.tsx`, rather than
 * silently rendering the wrong thing.
 *
 * A `.d.ts` is also the only spelling oxlint will accept for the
 * `export declare namespace JSX` this needs: `typescript/no-namespace` is an
 * error, and lint does not read `.d.ts`.
 */
import type { DOMTemplateLiterals, FunctionalComponent } from '@dineug/r-html';

type Falsy = false | null | undefined;

/**
 * What `toClassList` walks. Note the asymmetry this cannot express: a static
 * `class="a b"` becomes a `staticAttrs` entry and is written verbatim, but a
 * dynamic `class={value}` goes through `classCommit`, which returns early
 * unless the value is an object or an array — a bare string there is a silent
 * no-op today, in tagged templates just as much as in JSX.
 */
type ClassValue =
  | string
  | number
  | Record<string, unknown>
  | readonly ClassValue[]
  | Falsy;

/** `styleCommit` writes each entry with `setProperty`, so keys stay kebab-case. */
type StyleValue = Record<string, string | number | Falsy>;

/**
 * JSX rejects a repeated attribute outright (TS17001), but r-html keeps every
 * listener bound to one event name — `tNode` groups events and `EventPart` adds
 * each separately, and the order is observable. `on:input__2` is the escape
 * hatch: the codegen strips the suffix, so the second binding lands on `@input`
 * exactly like the first.
 *
 * Spelling the suffixes out rather than reaching for an `on:${string}` index
 * signature is what keeps `on:clik` a type error.
 */
type DuplicateSuffix = '' | '__2' | '__3';

type EventHandlers<M> = {
  [K in keyof M as `on:${string & K}${DuplicateSuffix}`]?: (
    event: M[K]
  ) => void;
};

/** The three sigils the transform maps onto r-html's attribute kinds. */
interface Sigils {
  /** `?name` — coerced with `isTruthy`, so not restricted to booleans. */
  [bool: `bool:${string}`]: unknown;
  /** `.name` — set as a DOM property rather than an attribute. */
  [prop: `prop:${string}`]: unknown;
  /** A bare marker in attribute position: `ref`, and any other directive. */
  [use: `use:${string}`]: unknown;
}

interface DatasetAttributes {
  [data: `data-${string}`]: string | number | boolean | Falsy;
  [aria: `aria-${string}`]: string | number | boolean | Falsy;
}

interface CommonAttributes extends Sigils, DatasetAttributes {
  /**
   * Deliberately `unknown`: a text position in r-html accepts primitives,
   * nested templates, arrays, DOM nodes, functions and directives, and
   * `getPartType` picks a `Part` for whatever turns up. Components are stricter
   * — their children land on the `children` prop and are typed by it.
   */
  children?: unknown;
  class?: ClassValue;
  style?: StyleValue;
  id?: string;
  title?: string;
}

interface HTMLAttributes
  extends CommonAttributes, EventHandlers<HTMLElementEventMap> {
  draggable?: boolean;
  hidden?: boolean;
  role?: string;
  spellcheck?: boolean;
  tabindex?: number;
}

interface SVGAttributes
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

interface ButtonAttributes extends HTMLAttributes {
  disabled?: boolean;
  name?: string;
  type?: 'button' | 'reset' | 'submit';
  value?: string;
}

interface ImgAttributes extends HTMLAttributes {
  alt?: string;
  height?: number | string;
  loading?: 'eager' | 'lazy';
  src?: string;
  width?: number | string;
}

interface InputAttributes extends HTMLAttributes {
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

interface TextareaAttributes extends HTMLAttributes {
  cols?: number;
  disabled?: boolean;
  name?: string;
  placeholder?: string;
  readonly?: boolean;
  rows?: number;
  value?: string;
}

interface TableCellAttributes extends HTMLAttributes {
  colspan?: number;
  rowspan?: number;
}

/** Mirrors `observedProps` on the `defineCustomElement('erd-editor', …)` call. */
interface ErdEditorAttributes extends HTMLAttributes {
  'enable-theme-builder'?: boolean;
  readonly?: boolean;
  'system-dark-mode'?: boolean;
}

interface SvgRootAttributes extends SVGAttributes {
  height?: number | string;
  preserveAspectRatio?: string;
  viewBox?: string;
  width?: number | string;
  xmlns?: string;
}

interface LineAttributes extends SVGAttributes {
  x1?: number | string;
  x2?: number | string;
  y1?: number | string;
  y2?: number | string;
}

interface CircleAttributes extends SVGAttributes {
  cx?: number | string;
  cy?: number | string;
  r?: number | string;
}

interface RectAttributes extends SVGAttributes {
  height?: number | string;
  rx?: number | string;
  ry?: number | string;
  width?: number | string;
  x?: number | string;
  y?: number | string;
}

interface PathAttributes extends SVGAttributes {
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
   * `@event` binding r-html routes to a component's event bus. It would sit on
   * top of every component's props — in completions and in every error message —
   * to type a binding this package uses zero times: all 84 components take
   * callbacks as props, and the two that dispatch do it on `ctx.host`, which is
   * the custom element, not the bus. Reinstating it is a deliberate act for
   * whoever first needs it.
   */

  /**
   * Every standard tag, taken straight from the DOM lib rather than listed by
   * hand: `HTMLElementTagNameMap` and `SVGElementTagNameMap` already are that
   * list, and reading them keeps this in step with the TypeScript version the
   * repo pins instead of drifting behind it.
   *
   * SVG contributes only the names HTML does not already define — `a`,
   * `script`, `style` and `title` exist in both, and HTML wins. Those four are
   * exactly the tags the codegen refuses to infer a namespace for, so an SVG
   * one has to sit inside an `<svg>` root anyway, where the namespace comes
   * from the root and not from this map.
   *
   * There is still no index signature: `<dvi>` is a typo, not an element.
   */
  interface IntrinsicElements
    extends IntrinsicHTMLElements, IntrinsicSVGElements {
    // Element-specific attributes, layered over the generic map above. Each is
    // a subtype of what it overrides, so the two stay assignable.
    button: ButtonAttributes;
    circle: CircleAttributes;
    'erd-editor': ErdEditorAttributes;
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
