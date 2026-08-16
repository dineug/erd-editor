import { join } from 'node:path';

import legacy from '@vitejs/plugin-legacy';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite-plus';

import { BROWSER_TARGET, BROWSER_TARGET_QUERY } from '../../build-target';
import { VitePWA } from 'vite-plugin-pwa';

const GTAG_ID = 'G-3VBWD4V1JX';

/**
 * Injects the analytics snippet in production only, replacing the
 * `<%= gtag %>` placeholder HtmlWebpackPlugin used to substitute.
 */
function gtag(isProduction: boolean): Plugin {
  return {
    name: 'gtag',
    transformIndexHtml: {
      order: 'pre',
      handler: html =>
        isProduction
          ? html.replace(
              '</body>',
              `  <script async src="https://www.googletagmanager.com/gtag/js?id=${GTAG_ID}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag() {
        dataLayer.push(arguments);
      }
      gtag('js', new Date());
      gtag('config', '${GTAG_ID}');
    </script>
  </body>`
            )
          : html,
    },
  };
}

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  const isTest = process.env.VITEST !== undefined;

  return {
    base: '/',

    plugins: [
      // emotion's `css` prop needs its own jsx runtime. tsconfig already sets
      // `jsxImportSource`, but that only informs the type checker — the
      // transform needs telling separately.
      react({ jsxImportSource: '@emotion/react' }),

      /**
       * Replaces `InjectManifest` (workbox-webpack-plugin) and
       * `WebpackPwaManifest`. The manifest is written out in full rather than
       * left to defaults: `start_url`, `scope` and `display` are what make the
       * installed app open standalone at the root, and losing any of them is
       * invisible until someone installs it.
       */
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'prompt',
        injectRegister: null,
        manifestFilename: 'manifest.json',
        manifest: {
          name: 'erd-editor',
          short_name: 'erd-editor',
          description: 'Entity-Relationship Diagram Editor App',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          theme_color: '#000',
          icons: [
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'maskable-icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        },
        devOptions: { enabled: false },
      }),

      /**
       * Runtime API polyfills. `build.target` transpiles syntax and does nothing
       * for APIs — a dependency calling `Array.prototype.toSorted` compiles
       * cleanly and throws on any browser that lacks it, which is how
       * `@radix-ui/themes@3` currently pushes the real floor to Chrome 110 /
       * Firefox 115 while this config says 91 / 93.
       *
       * `modernPolyfills` derives the set from `modernTargets` and injects only
       * what is missing, which is what swc's `mode: 'entry'` did before the
       * bundler change — not the whole of `core-js/stable`, which measured 542
       * modules / 63.93 kB gzip.
       *
       * `renderLegacyChunks: false` because there is no legacy build here; this
       * plugin is present for the polyfill analysis alone.
       */
      legacy({
        renderLegacyChunks: false,
        modernPolyfills: true,
        modernTargets: BROWSER_TARGET_QUERY,
      }),

      gtag(isProduction),
    ],

    /**
     * `import.meta.env.MODE` is Vite's own. `NOSTR_RELAY_URLS` is not, and the
     * previous DefinePlugin entry is what `services/collaborative/room.ts`
     * reads to point the mesh at a private relay — the e2e suite uses it to run
     * offline.
     *
     * Not defined under Vitest: replacing `import.meta.env.X` inside the test
     * runner's own module graph breaks specs that touch the same object.
     */
    define: isTest
      ? {}
      : {
          'import.meta.env.NOSTR_RELAY_URLS': JSON.stringify(
            process.env.ERD_EDITOR_NOSTR_RELAY_URLS ?? ''
          ),
        },

    build: {
      // The repo's one browser floor — see `build-target.ts` for how those
      // versions were measured and why `lib` stays a generation behind.
      target: BROWSER_TARGET,
      sourcemap: true,
      rolldownOptions: {
        output: {
          /**
           * `src/sw.ts` routes on `/\.[0-9a-f]{8,}\./` to decide what is
           * immutable enough for `CacheFirst`. Rolldown's default base64 hashes
           * never match that, and the route would silently stop caching
           * anything — so hex digits and dot separators are a contract with the
           * service worker, not a style choice.
           */
          hashCharacters: 'hex',
          entryFileNames: 'static/js/bundle.[hash:8].js',
          chunkFileNames: 'static/js/[name].[hash:8].js',
          assetFileNames: assetInfo =>
            assetInfo.names?.[0]?.endsWith('.css')
              ? 'static/css/bundle.[hash:8][extname]'
              : 'static/media/[name].[hash:8][extname]',
        },
      },
    },

    /**
     * Workers do not inherit `build.rolldownOptions.output`, so without this
     * their chunks land in `assets/` with base64 hashes — which
     * `src/sw.ts`'s `/\.[0-9a-f]{8,}\./` route never matches, silently
     * dropping them out of `CacheFirst`.
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

    server: {
      // Playwright drives the browser itself; see playwright.config.ts.
      open: !process.env.E2E,
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
            'vitest.config.*',
            'vitest.setup.ts',
            'package.json',
            'vite.config.ts',
            'index.html',
            'public/**',
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
            { pattern: 'packages/shared/dist/**/*.d.ts', base: 'workspace' },
            '!**/*.tsbuildinfo',
            '!dist/**',
          ],
          // 빠뜨리면 캐시 히트가 터미널 출력만 재생하고 산출물을 복원하지 않는다.
          output: ['dist/**'],
        },
        test: {
          // 타입 게이트 ②. `vp test`(built-in)는 run.tasks를 무시하므로 이 게이트를
          // 타지 않는다 — CI와 문서는 `vp run test`를 쓴다.
          command: ['tsc --noEmit', 'vp test run'],
          dependsOn: [
            {
              task: 'build',
              from: ['dependencies', 'devDependencies', 'peerDependencies'],
            },
          ],
          input: [
            { auto: true },
            'src/**',
            'vitest.config.*',
            'vitest.setup.ts',
            'package.json',
            'vite.config.ts',
            'index.html',
            'public/**',
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
            { pattern: 'packages/shared/dist/**/*.d.ts', base: 'workspace' },
            '!**/*.tsbuildinfo',
          ],
        },
      },
    },
  };
});
