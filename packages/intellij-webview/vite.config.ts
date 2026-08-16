import { join } from 'node:path';

import { defineConfig, type Plugin } from 'vite-plus';

/**
 * Strips `crossorigin` from the tags Vite injects. The IDE serves these assets
 * through a custom CEF scheme handler (`SchemeHandlerFactory` in the plugin
 * repo) which returns a body and a MIME type and nothing else — no CORS
 * headers — so a crossorigin module script is refused and the panel stays blank.
 */
function stripCrossorigin(): Plugin {
  return {
    name: 'strip-crossorigin',
    transformIndexHtml: {
      order: 'post',
      handler: html => html.replace(/\s+crossorigin(?=[\s>])/g, ''),
    },
  };
}

/**
 * Two outputs from one config. `vp build` writes `dist/` for local inspection;
 * `vp build --mode webview` writes into the IntelliJ plugin repo's
 * `src/main/resources/assets`, which is what ships.
 *
 * The scheme handler maps a URL path straight onto the classpath and assigns a
 * MIME type from a three-way `when` on the extension — `.html`, `.js`, `.css`.
 * Two consequences run through this file: `base` must stay `/` because the URL
 * path *is* the resource path, and nothing outside those three extensions may
 * be emitted, because anything else is served with no MIME type at all.
 */
export default defineConfig(({ mode }) => {
  const isWebview = mode === 'webview';

  return {
    base: '/',
    plugins: [stripCrossorigin()],
    // `index.html` is the entry and sits at the package root; there is no static
    // asset directory to copy.
    publicDir: false,

    build: {
      outDir: isWebview
        ? '../../../erd-editor-intellij-plugin/src/main/resources/assets'
        : 'dist',
      // ⚠️ In webview mode this clears a directory in *another repository*.
      // That is the intent — stale hashed bundles there are packaged into the
      // plugin jar — but it is also why `build:webview` is `cache: false`:
      // a cache hit cannot restore files Vite Task never archived.
      emptyOutDir: true,
      // webpack emitted no sourcemap in production, and `.map` is outside the
      // scheme handler's MIME whitelist.
      sourcemap: false,
      modulePreload: false,
      rolldownOptions: {
        output: {
          hashCharacters: 'hex',
          entryFileNames: 'static/js/bundle.[hash:8].js',
          chunkFileNames: 'static/js/[name].[hash:8].js',
          assetFileNames: 'static/css/bundle.[hash:8][extname]',
        },
      },
    },

    /**
     * `src/main.ts` constructs its worker with `{ type: 'module' }`. Vite's
     * default `worker.format` is `iife`, and an iife worker that gets code-split
     * loads its pieces with `importScripts`, which a module worker is not
     * allowed to call. Workers also do not inherit `build.rolldownOptions.output`,
     * so the naming has to be repeated here or the chunks land outside
     * `static/js` with base64 hashes.
     */
    worker: {
      format: 'es',
      rolldownOptions: {
        output: {
          hashCharacters: 'hex',
          entryFileNames: 'static/js/[name].[hash:8].js',
          chunkFileNames: 'static/js/[name].[hash:8].js',
        },
      },
    },

    resolve: {
      alias: {
        '@': join(import.meta.dirname, 'src'),
      },
    },

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
            'vite.config.ts',
            'index.html',
            'tsconfig.json',
            { pattern: 'tsconfig.app.json', base: 'workspace' },
            {
              pattern: 'packages/erd-editor/dist/**/*.d.ts',
              base: 'workspace',
            },
            {
              pattern: 'packages/erd-editor-shiki-worker/dist/**/*.d.ts',
              base: 'workspace',
            },
            {
              pattern: 'packages/vscode-bridge/dist/**/*.d.ts',
              base: 'workspace',
            },
            { pattern: 'packages/shared/dist/**/*.d.ts', base: 'workspace' },
            '!**/*.tsbuildinfo',
            '!dist/**',
          ],
          // 빠뜨리면 캐시 히트가 터미널 출력만 재생하고 산출물을 복원하지 않는다.
          output: ['dist/**'],
        },
        'build:webview': {
          command: ['tsc --noEmit', 'vp build --mode webview'],
          dependsOn: [
            {
              task: 'build',
              from: ['dependencies', 'devDependencies', 'peerDependencies'],
            },
          ],
          // 산출물이 이 레포 밖(erd-editor-intellij-plugin/src/main/resources/assets)이라 캐시가 복원할
          // 수 없다. 히트가 나면 IntelliJ 플러그인은 어제 자 assets로 빌드된다.
          cache: false,
        },
      },
    },
  };
});
