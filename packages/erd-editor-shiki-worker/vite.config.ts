import { join } from 'node:path';

import { defineConfig, lazyPlugins } from 'vite-plus';
import dts from 'vite-plugin-dts';
import { BROWSER_TARGET } from '../../build-target';
import { createLibraryTasks } from '../../tools/vite/library-config.ts';
import {
  createBanner,
  loadLibraryMetadata,
} from '../../tools/vite/package-metadata.ts';

const packageDir = import.meta.dirname;
const { manifest } = loadLibraryMetadata(packageDir);
const banner = createBanner(manifest);

/** Chromium이 URL 하나에 허용하는 최대 길이. 넘기면 워커가 로드되지 않는다. */
const MAX_URL_LENGTH = 2 * 1024 * 1024;

const INLINE_WORKER_URL =
  /"data:text\/javascript;charset=utf-8," \+ encodeURIComponent\((\w+)\)/g;

/**
 * 인라인 워커 URL을 percent 인코딩에서 base64로 바꾼다. percent 인코딩은 1.8배로
 * 부풀어 MAX_URL_LENGTH를 넘기면 SharedWorker가 빈 에러만 남기고 실패한다.
 * base64는 1.33배고, blob URL과 달리 같은 소스가 항상 같은 URL이다.
 */
function base64InlineWorker() {
  return {
    name: 'erd-editor:base64-inline-worker',
    renderChunk(code: string) {
      const matches = [...code.matchAll(INLINE_WORKER_URL)];
      if (!matches.length) return null;

      for (const [, ident] of matches) {
        const source = readStringLiteral(code, ident);
        // 워커 소스를 못 읽으면 길이를 잴 수 없다. 조용한 실패로 돌아가느니 멈춘다.
        if (source === null) {
          throw new Error(
            `[base64InlineWorker] could not read the inlined worker source \`${ident}\``
          );
        }

        const length =
          'data:text/javascript;base64,'.length +
          4 * Math.ceil(Buffer.byteLength(source, 'utf8') / 3);
        if (length > MAX_URL_LENGTH) {
          throw new Error(
            `[base64InlineWorker] inlined worker URL is ${length} chars, over the ${MAX_URL_LENGTH} limit ` +
              `by ${length - MAX_URL_LENGTH}. Drop a grammar or theme — shipping this builds a highlighter that never starts.`
          );
        }
      }

      // 배너가 파일 첫머리를 지키도록 뒤에 붙인다. 함수 선언이라 호이스팅된다.
      return {
        code: `${code.replace(
          INLINE_WORKER_URL,
          (_, ident) => `__toDataUrl(${ident})`
        )}\n${TO_DATA_URL}`,
        map: null,
      };
    },
  };
}

const TO_DATA_URL = `function __toDataUrl(source) {
\tconst bytes = new TextEncoder().encode(source);
\tlet binary = "";
\tfor (let i = 0; i < bytes.length; i += 0x8000) {
\t\tbinary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
\t}
\treturn "data:text/javascript;base64," + btoa(binary);
}`;

/** var <ident> = "..."의 문자열 리터럴을 이스케이프를 지켜가며 읽어 값으로 돌려준다. */
function readStringLiteral(code: string, ident: string): string | null {
  const declaration = new RegExp(
    `(?:var|const|let)\\s+${ident}\\s*=\\s*"`
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

export default defineConfig({
  run: {
    tasks: createLibraryTasks(packageDir),
  },
  define: {
    __APP_VERSION__: JSON.stringify(manifest.version),
  },
  build: {
    // 공개 라이브러리의 하한은 한 곳에서 온다 — 루트 build-target.ts.
    target: BROWSER_TARGET,
    lib: {
      entry: './src/index.ts',
      fileName: 'erd-editor-shiki-worker',
      formats: ['es'],
    },
    rolldownOptions: {
      output: {
        banner,
      },
    },
  },
  resolve: {
    alias: {
      '@': join(import.meta.dirname, 'src'),
    },
  },
  plugins: lazyPlugins(() => [dts(), base64InlineWorker()]),
});
