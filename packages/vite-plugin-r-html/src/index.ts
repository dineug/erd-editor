import type { Plugin } from 'vite';

import { rHtmlJsx } from './jsx/plugin';
import type { Options } from './options';
import { rHtmlRefresh } from './refresh';

export { transformJsxToTagged } from './jsx/codegen';
export type { JsxOptions, Options, RefreshOptions } from './options';

/**
 * Everything this package does, as one plugin entry. The two halves have
 * opposite ordering requirements and each declares its own enforce and apply,
 * so composing them here leaves the caller no way to wire the order wrong.
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
