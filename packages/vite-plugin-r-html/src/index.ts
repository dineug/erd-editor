import type { Plugin } from 'vite';

import { rHtmlJsx } from './jsx/plugin';
import type { Options } from './options';
import { rHtmlRefresh } from './refresh';

export { transformJsxToTagged } from './jsx/codegen';
export type { JsxOptions, Options, RefreshOptions } from './options';

/**
 * Everything this package does, as one plugin entry.
 *
 * The two halves have opposite ordering requirements — the JSX transform has to
 * run before `vite:oxc` to see raw JSX, the refresh transform has to run after
 * it to see plain JS — and each declares its own `enforce` / `apply`. Composing
 * them here keeps that off the caller: `plugins: [rHtml()]` is correct in every
 * mode, and there is no way to wire the order wrong.
 */
export function rHtml(options: Options = {}): Plugin[] {
  const { jsx, refresh, ...shared } = options;
  const plugins: Plugin[] = [];

  if (jsx !== false) {
    plugins.push(rHtmlJsx({ ...shared, ...jsx }));
  }
  if (refresh !== false) {
    plugins.push(rHtmlRefresh({ ...shared, ...refresh }));
  }

  return plugins;
}
