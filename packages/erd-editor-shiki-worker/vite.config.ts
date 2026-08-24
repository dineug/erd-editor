import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { defineConfig, lazyPlugins } from 'vite-plus';
import dts from 'vite-plugin-dts';
import { BROWSER_TARGET } from '../../build-target';

const pkg = JSON.parse(readFileSync('package.json', { encoding: 'utf8' }));

const banner = `/*!
 * ${pkg.name}
 * @version ${pkg.version} | ${new Date().toDateString()}
 * @author ${pkg.author}
 * @license ${pkg.license}
 */`;

/** Chromium이 URL 하나에 허용하는 최대 길이. 넘기면 워커가 로드되지 않는다. */
const MAX_URL_LENGTH = 2 * 1024 * 1024;

const INLINE_WORKER_URL =
  /"data:text\/javascript;charset=utf-8," \+ encodeURIComponent\((\w+)\)/g;

/**
 * `?sharedworker&inline`이 만드는 워커 URL을 percent 인코딩에서 base64로 바꾼다.
 *
 * percent 인코딩은 TextMate 문법의 `"` `{` `\` 를 전부 `%XX` 3자로 부풀려 1.8배가
 * 되는데, 그 결과가 `MAX_URL_LENGTH`를 넘으면 `new SharedWorker`가 **본문이 빈**
 * 에러 이벤트만 남기고 실패한다. Comlink는 응답을 영원히 기다리고 패널은 조용히
 * 빈 채로 남는다 — 로그도 스택도 없다. base64는 1.33배고, blob URL과 달리 같은
 * 소스가 항상 같은 URL이라 탭마다 SharedWorker가 갈라지지 않는다.
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

/** `var <ident> = "..."`의 문자열 리터럴을 이스케이프를 지켜가며 읽어 값으로 돌려준다. */
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
  /**
   * nx.json `targetDefaults`의 대체. `dependsOn`이 `^build`를, `output`이
   * `outputs: ["{projectRoot}/dist"]`를 잇는다.
   *
   * `from`에 셋을 다 적는 이유: 워크스페이스 의존이 패키지마다 다른 필드에 있다 —
   * 라이브러리 아홉은 전부 devDependencies에 걸고, 앱 형태 넷은 dependencies에 건다.
   * 기본값(`dependencies`)에 맡기면 라이브러리 쪽 간선이 통째로 비고, 그 결과는
   * 실패가 아니라 stale dist를 상대로 한 초록이다.
   */
  run: {
    tasks: {
      build: {
        // 타입 게이트 ①. 배열은 순차 실행이자 독립 캐시 단위인데, 태스크 레벨
        // `input`은 두 서브태스크가 공유한다(실측) — 그래서 소스만 바뀌어도
        // 자동 추적에 안 잡히는 `tsc`가 다시 돈다.
        command: ['tsc --noEmit', 'vp build'],
        dependsOn: [
          {
            task: 'build',
            from: ['dependencies', 'devDependencies', 'peerDependencies'],
          },
        ],
        input: [
          { auto: true },
          'src/**',
          'package.json',
          'tsconfig.json',
          { pattern: 'tsconfig.app.json', base: 'workspace' },
          '!**/*.tsbuildinfo',
          '!dist/**',
        ],
        // 빠뜨리면 캐시 히트가 터미널 출력만 재생하고 산출물을 복원하지 않는다.
        output: ['dist/**'],
      },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    // 공개 라이브러리의 하한은 한 곳에서 온다 — 루트 `build-target.ts`.
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
