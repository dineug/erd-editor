export type Matcher = string | RegExp | Array<string | RegExp>;

export interface RefreshOptions {
  include?: Matcher;
  exclude?: Matcher;
  /** Where the injected hmr() activation is imported from. */
  importSource?: string;
}

export interface JsxOptions {
  include?: Matcher;
  exclude?: Matcher;
  /** Where the injected html / svg tags are imported from. */
  importSource?: string;
}

export interface Options {
  include?: Matcher;
  exclude?: Matcher;
  /** Where both halves import r-html from — html / svg, and hmr. */
  importSource?: string;
  /** Set false to compile no JSX, or narrow the transform on its own. */
  jsx?: JsxOptions | false;
  /** Set false to opt out of hot module replacement. */
  refresh?: RefreshOptions | false;
}
