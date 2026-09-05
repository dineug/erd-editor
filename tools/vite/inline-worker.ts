import { dirname, resolve } from 'node:path';

import type { Plugin } from 'vite-plus';

/** Chromium's limit on one URL. A data url past it builds a worker that never starts. */
export const MAX_URL_LENGTH = 2 * 1024 * 1024;

/**
 * The expression Vite's inline wrapper builds. Two wrappers in one chunk
 * declare the same jsContent, and rolldown renames the second jsContent$1,
 * so the identifier admits a dollar sign.
 */
const PERCENT_ENCODED_WORKER =
  /"data:text\/javascript;charset=utf-8,"\s*\+\s*encodeURIComponent\(([\w$]+)\)/g;

const TO_DATA_URL = `function __toDataUrl(source) {
\tconst bytes = new TextEncoder().encode(source);
\tlet binary = "";
\tfor (let i = 0; i < bytes.length; i += 0x8000) {
\t\tbinary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
\t}
\treturn "data:text/javascript;base64," + btoa(binary);
}`;

/** Reads the string literal a var, const or let of that name is assigned, escapes honoured. */
export function readStringLiteral(code: string, ident: string): string | null {
  const declaration = new RegExp(
    `(?:var|const|let)\\s+${ident.replace(/\$/g, '\\$')}\\s*=\\s*"`
  ).exec(code);
  if (!declaration) return null;

  const start = declaration.index + declaration[0].length;
  for (let i = start; i < code.length; i++) {
    if (code[i] === '\\') {
      i++;
      continue;
    }
    if (code[i] === '"') {
      return Function(`return "${code.slice(start, i)}"`)();
    }
  }
  return null;
}

/** The length of the base64 data url that source becomes. */
export function base64UrlLength(source: string): number {
  return (
    'data:text/javascript;base64,'.length +
    4 * Math.ceil(Buffer.byteLength(source, 'utf8') / 3)
  );
}

/**
 * Re-encodes every inline shared worker url in a chunk from percent encoding
 * to base64. Percent encoding grows a grammar 1.8x and past MAX_URL_LENGTH
 * new SharedWorker fails with an empty error event; base64 grows it 1.33x.
 */
export function rewriteInlineWorkers(code: string): string | null {
  const matches = [...code.matchAll(PERCENT_ENCODED_WORKER)];
  if (!matches.length) return null;

  for (const [, ident] of matches) {
    const source = readStringLiteral(code, ident);
    if (source === null) {
      throw new Error(
        `[inlineWorkers] could not read the inlined worker source ${ident}`
      );
    }

    const length = base64UrlLength(source);
    if (length > MAX_URL_LENGTH) {
      throw new Error(
        `[inlineWorkers] inlined worker url is ${length} chars, over the ${MAX_URL_LENGTH} limit by ${length - MAX_URL_LENGTH}. Shipping this builds a worker that never starts.`
      );
    }
  }

  // Appended rather than prepended so a banner keeps the first line; a function
  // declaration hoists.
  return `${code.replace(
    PERCENT_ENCODED_WORKER,
    (_, ident) => `__toDataUrl(${ident})`
  )}\n${TO_DATA_URL}`;
}

/** Throws when a chunk still carries a percent-encoded worker url, in either spelling a minifier leaves. */
export function assertInlineWorkersEncoded(fileName: string, code: string) {
  if (/data:text\/javascript;charset=utf-8,/.test(code)) {
    throw new Error(
      `[inlineWorkers] a percent-encoded worker url in ${fileName} survived the rewrite; the length guard never ran on it`
    );
  }
}

/**
 * Vite inlines a shared worker as a percent-encoded data url, the one form a
 * SharedWorker can share between documents. This runs post, once that url is
 * written, and swaps the encoding for base64 with the length guard above.
 */
export function base64InlineWorkers(): Plugin {
  return {
    name: 'erd-editor:base64-inline-workers',
    enforce: 'post',
    apply: 'build',
    renderChunk(code) {
      const rewritten = rewriteInlineWorkers(code);
      return rewritten === null ? null : { code: rewritten, map: null };
    },
    generateBundle(_, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type === 'chunk') {
          assertInlineWorkersEncoded(output.fileName, output.code);
        }
      }
    },
  };
}

/** The dist files of the workspace packages that construct a worker from a url. */
const WORKER_HOSTS =
  /[\\/](erd-editor|erd-editor-shiki-worker|(?:erd-editor-)?replication-store-worker)[\\/]dist[\\/].*\.js$/;

/** The one spelling those packages emit, through the comma before the options if there is one. */
const URL_WORKER =
  /new (SharedWorker|Worker)\(new URL\("(\.\.?\/[^"]+)", import\.meta\.url\)(?:,\s*|(?=\)))/g;

/** Throws when a chunk still constructs a worker from a url, which this host cannot load. */
export function assertNoUrlWorkers(fileName: string, code: string) {
  if (/new (?:Shared)?Worker\(new URL\(/.test(code)) {
    throw new Error(
      `[inlineWorkers] a url worker in ${fileName} survived into a host that cannot load one`
    );
  }
}

/**
 * Rewrites every url worker in one of those dist files into Vite's inline
 * import of the same file, so the worker script travels inside the chunk. Null
 * when the file is not one of theirs or constructs no worker that way.
 */
export function rewriteUrlWorkers(code: string, id: string): string | null {
  if (!WORKER_HOSTS.test(id)) return null;

  const imports: string[] = [];
  const rewritten = code.replace(URL_WORKER, (_, kind: string, url: string) => {
    const name = `__inlineWorker${imports.length}`;
    const file = resolve(dirname(id), url);
    const query = kind === 'SharedWorker' ? 'sharedworker' : 'worker';
    imports.push(
      `import ${name} from ${JSON.stringify(`${file}?${query}&inline`)};`
    );
    return `new ${name}(`;
  });

  return imports.length ? `${imports.join('\n')}\n${rewritten}` : null;
}

/**
 * For a host whose document and scripts sit on different origins, where a
 * worker script is the one resource a browser refuses across that line: the
 * editor packages' url workers become inline ones before Vite sees them.
 */
export function inlineDependencyWorkers(): Plugin {
  return {
    name: 'erd-editor:inline-dependency-workers',
    enforce: 'pre',
    apply: 'build',
    transform(code, id) {
      const rewritten = rewriteUrlWorkers(code, id);
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
