import { posix } from 'node:path';

import type { Plugin } from 'vite-plus';

/**
 * The URL Vite writes for a worker it bundled: joined to base, so absolute,
 * marked @vite-ignore, and in lib mode prefixed with "" +. A page can serve
 * that; from a library it lands under the consumer's root and no bundler reads it.
 */
const VITE_WORKER_URL =
  /new URL\(\s*(?:\/\*\s*@vite-ignore\s*\*\/\s*)?"(\/[^"]+)"\s*,\s*(?:""\s*\+\s*)?import\.meta\.url\s*\)/g;

/**
 * Turns one absolute worker URL into the path from the chunk that names it,
 * spelled so a relative URL always starts with a dot.
 */
export function relativeWorkerUrl(chunkFileName: string, url: string): string {
  const relative = posix.relative(posix.dirname(chunkFileName), url.slice(1));
  return relative.startsWith('.') ? relative : `./${relative}`;
}

/**
 * Rewrites every worker URL in a library chunk into the one spelling webpack,
 * Rspack and Vite all resolve statically from inside a dependency and bundle
 * as an entry of their own: new URL("./workers/file.js", import.meta.url).
 */
export function rewriteWorkerUrls(code: string, chunkFileName: string): string {
  return code.replace(
    VITE_WORKER_URL,
    (_, url: string) =>
      `new URL(${JSON.stringify(relativeWorkerUrl(chunkFileName, url))}, import.meta.url)`
  );
}

/** A worker url the rewrite did not reach, which is how a change in Vite's spelling would show. */
const SURVIVING_WORKER_URL = /new URL\(\s*\/\*\s*@vite-ignore\s*\*\//;

/** Throws when a chunk still carries the url shape Vite wrote. */
export function assertWorkerUrlsRewritten(fileName: string, code: string) {
  if (SURVIVING_WORKER_URL.test(code)) {
    throw new Error(
      `[libraryWorkerUrls] a worker url in ${fileName} survived the rewrite; Vite changed the shape it writes`
    );
  }
}

/**
 * Applies rewriteWorkerUrls to every chunk of a library build. It runs post so
 * the URL it reads is the one Vite has finished writing, and it stays out of a
 * page build, such as Storybook's, where the absolute URL is the right one.
 */
export function libraryWorkerUrls(): Plugin {
  let library = false;

  return {
    name: 'erd-editor:library-worker-urls',
    enforce: 'post',
    apply: 'build',
    configResolved(config) {
      library = Boolean(config.build.lib);
      // relativeWorkerUrl strips one leading slash, which is the whole base.
      if (library && config.base !== '/') {
        throw new Error(
          `[libraryWorkerUrls] a library build keeps base at /, this one has ${config.base}`
        );
      }
    },
    renderChunk(code, chunk) {
      if (!library) return null;
      const rewritten = rewriteWorkerUrls(code, chunk.fileName);
      return rewritten === code ? null : { code: rewritten, map: null };
    },
    generateBundle(_, bundle) {
      if (!library) return;
      for (const output of Object.values(bundle)) {
        if (output.type === 'chunk') {
          assertWorkerUrlsRewritten(output.fileName, output.code);
        }
      }
    },
  };
}
