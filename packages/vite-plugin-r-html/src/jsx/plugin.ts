import { createFilter } from '@rollup/pluginutils';
import type { Plugin } from 'vite';

import { transformJsxToTagged } from './codegen';

export interface JsxOptions {
  include?: string | RegExp | Array<string | RegExp>;
  exclude?: string | RegExp | Array<string | RegExp>;
  /** Where the injected `html` / `svg` tags are imported from. */
  importSource?: string;
}

const cleanId = (id: string) => id.split('?')[0];

/**
 * Compiles JSX back into the `html` / `svg` tagged templates r-html already
 * consumes, so the runtime never learns that JSX exists.
 *
 * `enforce: 'pre'` is required — this needs the raw JSX, before `vite:oxc`
 * reaches it. That is the opposite of the sibling `rHtml()` refresh plugin in
 * `../index.ts`, which calls `@babel/core` with no parser plugins configured
 * and therefore only works *because* oxc has already stripped the types ahead
 * of it. Two plugins in one package with opposite ordering requirements: keep
 * them straight.
 */
export function rHtmlJsx(options: JsxOptions = {}): Plugin {
  const filter = createFilter(
    options.include ?? /\.tsx$/,
    options.exclude ?? '**/node_modules/**'
  );

  return {
    name: 'vite:r-html-jsx',
    enforce: 'pre',
    transform(code, id) {
      const path = cleanId(id);
      if (!path.endsWith('.tsx') || !filter(path)) {
        return;
      }

      const transformed = transformJsxToTagged(
        code,
        path,
        options.importSource
      );
      return transformed === null
        ? undefined
        : { code: transformed, map: null };
    },
  };
}

export default rHtmlJsx;
