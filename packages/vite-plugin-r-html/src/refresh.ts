// @ts-ignore
import * as t from '@babel/core';
import { createFilter } from '@rollup/pluginutils';
import type { Plugin } from 'vite';

import type { RefreshOptions } from './options';

const importMetaHot = `${'import'}.${'meta'}.${'hot'}`;

const DEFAULT_EXPORT = /\bexport\s+default\b/;

const hmr = (name: string) => `
if (${importMetaHot}) {
  ${importMetaHot}.accept((mod) => {
    window.dispatchEvent(new CustomEvent('hmr:r-html', {
      detail: {originComponent: ${name}, newComponent: mod?.default}
    }));
  });
}
`;

/**
 * Marks component modules as HMR boundaries so `r-html`'s `hmr.ts` can swap them
 * in place. `apply: 'serve'` rather than a caller-side `isServe` gate: only the
 * dev server has `import.meta.hot` to accept on.
 *
 * Must NOT be `enforce: 'pre'` — it calls Babel with no parser plugins, so it
 * can only parse once `vite:oxc` has stripped the types ahead of it.
 */
export function rHtmlRefresh(options: RefreshOptions = {}): Plugin {
  const filter = createFilter(
    options.include,
    options.exclude ?? '**/node_modules/**'
  );

  return {
    name: 'vite:r-html-refresh',
    apply: 'serve',
    async transform(code, id) {
      if (!filter(id)) {
        return;
      }

      // Nothing is injected without an `export default`, so modules that have
      // none never need to be parsed. Without this the dev server runs Babel
      // over every module in the graph on startup and on every change.
      if (!DEFAULT_EXPORT.test(code)) {
        return;
      }

      const result = await t.transformAsync(code, {
        babelrc: false,
        configFile: false,
        ast: true,
        code: false,
        filename: id,
      });

      // @ts-ignore
      const isBoundary = result?.ast?.program.body.every(node => {
        if (node.type !== 'ExportNamedDeclaration') {
          return true;
        }
        const { declaration, specifiers } = node;

        if (declaration) {
          if (declaration.type === 'VariableDeclaration') {
            // @ts-ignore
            return declaration.declarations.every(variable =>
              isComponentLikeIdentifier(variable.id)
            );
          }
          if (declaration.type === 'FunctionDeclaration') {
            return (
              !!declaration.id && isComponentLikeIdentifier(declaration.id)
            );
          }
        }
        // @ts-ignore
        return specifiers.every(spec => {
          return isComponentLikeIdentifier(spec.exported);
        });
      });

      if (!isBoundary) {
        return;
      }

      const node = result?.ast?.program.body.find(
        // @ts-ignore
        node => node.type === 'ExportDefaultDeclaration'
      );

      if (node?.type === 'ExportDefaultDeclaration') {
        const declaration = node.declaration as any;
        // `export default A` is an Identifier; `export default function A() {}`
        // carries the name on `.id`. Reading only `.name` made the second form
        // inject `originComponent: undefined` — which still marks the module
        // self-accepting, so Vite stops propagating and the edit does nothing
        // at all, not even a reload.
        const name =
          declaration.type === 'Identifier'
            ? declaration.name
            : declaration.id?.name;

        if (!name) {
          return;
        }

        return {
          code: code + hmr(name),
        };
      }
    },
  };
}

function isComponentLikeIdentifier(node: t.Node): boolean {
  return node.type === 'Identifier' && isComponentLikeName(node.name);
}

function isComponentLikeName(name: string): boolean {
  return typeof name === 'string' && name[0] >= 'A' && name[0] <= 'Z';
}
