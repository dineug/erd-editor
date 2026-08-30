// @ts-ignore
import * as t from '@babel/core';
import { createFilter } from '@rollup/pluginutils';
import type { Plugin } from 'vite';

import type { RefreshOptions } from './options';

const importMetaHot = `${'import'}.${'meta'}.${'hot'}`;

const DEFAULT_EXPORT = /\bexport\s+default\b/;

/**
 * The module that calls hmr(), which registers r-html's listener. Every
 * boundary imports it and module semantics evaluate it once, so the listener is
 * registered by the same act that creates something for it to hear.
 */
const VIRTUAL_ID = 'virtual:r-html-hmr';
const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_ID}`;

/**
 * Appended, never prepended, so no line below it moves; a top-level import is
 * hoisted whatever its position. It sits outside the if because an import
 * declaration cannot live in a block.
 */
const hmr = (name: string) => `
import '${VIRTUAL_ID}';
if (${importMetaHot}) {
  ${importMetaHot}.accept((mod) => {
    window.dispatchEvent(new CustomEvent('hmr:r-html', {
      detail: {originComponent: ${name}, newComponent: mod?.default}
    }));
  });
}
`;

/**
 * Marks component modules as HMR boundaries so hmr.ts can swap them in place.
 * apply: serve is the whole dev/production switch, and this must not be
 * enforce: pre, because Babel here parses only once the types are stripped.
 */
export function rHtmlRefresh(options: RefreshOptions = {}): Plugin {
  const filter = createFilter(
    options.include,
    options.exclude ?? '**/node_modules/**'
  );
  const importSource = options.importSource ?? '@dineug/r-html';

  return {
    name: 'vite:r-html-refresh',
    apply: 'serve',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_VIRTUAL_ID : undefined;
    },
    load(id) {
      return id === RESOLVED_VIRTUAL_ID
        ? `import { hmr } from '${importSource}';\nhmr();\n`
        : undefined;
    },
    async transform(code, id) {
      if (!filter(id)) {
        return;
      }

      // Nothing is injected without an export default, so modules that have
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
        // A default-exported identifier and a default-exported function carry
        // the name in different places. Missing one injects an undefined origin,
        // which still self-accepts, so Vite stops propagating and nothing runs.
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
