import { createFilter } from '@rollup/pluginutils';
import type { Plugin } from 'vite';

import type { JsxOptions } from '../options';
import { transformJsxToTagged } from './codegen';

const cleanId = (id: string) => id.split('?')[0];

/**
 * Compiles JSX back into the tagged templates r-html already consumes, so the
 * runtime never learns JSX exists. enforce: pre is required, because this needs
 * the raw JSX — the opposite of the sibling refresh plugin's requirement.
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
        options.importSource,
        options.konvaImportSource
      );
      return transformed === null
        ? undefined
        : { code: transformed, map: null };
    },
  };
}
