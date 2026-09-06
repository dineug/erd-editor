import { dirname, resolve } from 'node:path';

import type { Plugin } from 'vite-plus';

/** The dist files of the workspace packages that construct a worker from a url. */
const WORKER_HOSTS =
  /[\\/](erd-editor|(?:erd-editor-)?replication-store-worker)[\\/]dist[\\/].*\.js$/;

/**
 * The one spelling those packages emit. The last group is the separator before
 * the options, empty where there are none, and it is kept so the options the
 * dist file wrote survive the rewrite untouched.
 */
const URL_WORKER =
  /new (SharedWorker|Worker)\(new URL\("(\.\.?\/[^"]+)", import\.meta\.url\)(,\s*|(?=\)))/g;

/** Throws when a chunk still constructs a worker from a url, which this host cannot load. */
export function assertNoUrlWorkers(fileName: string, code: string) {
  if (/new (?:Shared)?Worker\(new URL\(/.test(code)) {
    throw new Error(
      `[sameOriginWorkers] a url worker in ${fileName} survived into a host that cannot load one`
    );
  }
}

/**
 * Rewrites every url worker in one of those dist files to read its script
 * through the runtime module: the url still names a file Vite bundles and
 * emits, and the constructor is handed the blob url the document read it into.
 */
export function rewriteUrlWorkersToBlob(
  code: string,
  id: string,
  runtime: string
): string | null {
  if (!WORKER_HOSTS.test(id)) return null;

  const sources: string[] = [];
  const rewritten = code.replace(
    URL_WORKER,
    (_, kind: string, url: string, tail: string) => {
      const index = sources.length;
      const file = resolve(dirname(id), url);
      const query = kind === 'SharedWorker' ? 'sharedworker' : 'worker';
      sources.push(
        `import __workerUrl${index} from ${JSON.stringify(`${file}?${query}&url`)};
const __workerSource${index} = __registerWorkerSource(__workerUrl${index});`
      );
      return `new ${kind}(__workerBlobUrl(__workerSource${index})${tail}`;
    }
  );

  if (!sources.length) return null;

  const runtimeImport = `import { registerWorkerSource as __registerWorkerSource, workerBlobUrl as __workerBlobUrl } from ${JSON.stringify(runtime)};`;

  return `${runtimeImport}\n${sources.join('\n')}\n${rewritten}`;
}

export type SameOriginWorkerOptions = {
  /**
   * The module the rewrite reads its two helpers from, by absolute path. The
   * host imports the same module to wait on the reads before it mounts.
   */
  runtime: string;
};

/**
 * For a host whose document and scripts sit on different origins, where a
 * worker constructor refuses a script url across that line before it fetches:
 * the editor packages' url workers are read by the document and built from blobs.
 */
export function sameOriginDependencyWorkers({
  runtime,
}: SameOriginWorkerOptions): Plugin {
  return {
    name: 'erd-editor:same-origin-dependency-workers',
    enforce: 'pre',
    apply: 'build',
    transform(code, id) {
      const rewritten = rewriteUrlWorkersToBlob(code, id, runtime);
      return rewritten === null ? null : { code: rewritten, map: null };
    },
    generateBundle(_, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type === 'chunk')
          assertNoUrlWorkers(output.fileName, output.code);
      }
    },
  };
}
