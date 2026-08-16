export type Matcher = string | RegExp | Array<string | RegExp>;

export interface RefreshOptions {
  include?: Matcher;
  exclude?: Matcher;
}

export interface JsxOptions {
  include?: Matcher;
  exclude?: Matcher;
  /** Where the injected `html` / `svg` tags are imported from. */
  importSource?: string;
}

export interface Options {
  include?: Matcher;
  exclude?: Matcher;
  /** Where the JSX transform imports `html` / `svg` from. */
  importSource?: string;
  /** Set `false` to compile no JSX, or narrow the transform on its own. */
  jsx?: JsxOptions | false;
  /** Set `false` to opt out of hot module replacement. */
  refresh?: RefreshOptions | false;
}
