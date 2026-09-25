import { join } from 'node:path';

import legacy from '@vitejs/plugin-legacy';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite-plus';

import { BROWSER_TARGET, BROWSER_TARGET_QUERY } from '../../build-target';
import { createAuthDevMiddleware } from './src/server/auth/nodeAdapter';
import { VitePWA } from 'vite-plugin-pwa';

const GTAG_ID = 'G-3VBWD4V1JX';

/**
 * Injects the analytics snippet in production only. Added from script, never
 * on /gdrive or on a sign-in popup a deploy answered with the app, in any case
 * or percent-encoding the router matches, it keeps Google user data out.
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
              `  <script>
      var gtagPath = location.pathname;
      try {
        gtagPath = decodeURI(gtagPath);
      } catch (error) {}
      gtagPath = gtagPath.toLowerCase();
      if (!gtagPath.startsWith('/gdrive') && !gtagPath.startsWith('/api/auth')) {
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () {
          dataLayer.push(arguments);
        };
        gtag('js', new Date());
        gtag('config', '${GTAG_ID}');
        var gtagScript = document.createElement('script');
        gtagScript.async = true;
        gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=${GTAG_ID}';
        document.head.appendChild(gtagScript);
      }
    </script>
  </body>`
            )
          : html,
    },
  };
}

/**
 * Serves /api/auth/* from the handlers the Pages Function runs. Added straight
 * away, not from a returned hook, it precedes Vite's transform, static and SPA
 * fallback middlewares; Vite's request, cors and host checks still run first.
 */
function gdriveDevServer(mode: string): Plugin {
  return {
    name: 'gdrive-dev-server',
    apply: 'serve',
    configureServer(server) {
      // Secrets come from the env or packages/app/.env.local.
      const env = loadEnv(mode, import.meta.dirname, '');
      server.middlewares.use(
        createAuthDevMiddleware({
          getEnv: () => ({
            GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
            COOKIE_KEY: env.COOKIE_KEY,
            VITE_GOOGLE_CLIENT_ID: env.VITE_GOOGLE_CLIENT_ID,
          }),
          // Only the e2e harness sets this, pointing Google's token and revoke
          // endpoints at its fake; the Pages Function never reads it.
          oauthBaseUrl: env.ERD_EDITOR_E2E_GOOGLE_OAUTH_URL || undefined,
        })
      );
    },
  };
}

const POLICY_PAGES = new Set(['/privacy', '/terms']);

/**
 * Answers /privacy and /terms with their files in public/, as Pages does for an
 * extensionless path. Vite would send them the app, whose catch-all route leads
 * to /, so the policy spec would read the wrong page.
 */
function policyPages(): Plugin {
  return {
    name: 'policy-pages',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url ?? '';
        const queryAt = url.indexOf('?');
        const pathname = queryAt === -1 ? url : url.slice(0, queryAt);
        if (POLICY_PAGES.has(pathname)) {
          req.url = `${pathname}.html${url.slice(pathname.length)}`;
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  const isTest = process.env.VITEST !== undefined;

  return {
    base: '/',

    plugins: [
      // emotion's css prop needs its own jsx runtime. tsconfig already sets
      // jsxImportSource, but that only informs the type checker — the
      // transform needs telling separately.
      react({ jsxImportSource: '@emotion/react' }),

      /**
       * The manifest is written out in full rather than left to defaults:
       * start_url, scope and display are what make the installed app open
       * standalone at the root, and losing one is invisible until installed.
       */
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'prompt',
        injectRegister: null,
        manifestFilename: 'manifest.json',
        manifest: {
          name: 'ERD Editor',
          short_name: 'ERD Editor',
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
       * Runtime API polyfills, derived from modernTargets and injected only
       * where missing. build.target transpiles syntax and does nothing for
       * APIs, so a dependency's newer call compiles cleanly and then throws.
       */
      legacy({
        renderLegacyChunks: false,
        modernPolyfills: true,
        modernTargets: BROWSER_TARGET_QUERY,
      }),

      gtag(isProduction),

      gdriveDevServer(mode),

      policyPages(),
    ],

    /**
     * NOSTR_RELAY_URLS is what services/collaborative/room.ts reads to point
     * the mesh at a private relay, which is how the e2e suite runs offline. Not
     * defined under Vitest, where replacing it breaks the runner's own graph.
     */
    define: isTest
      ? {}
      : {
          'import.meta.env.NOSTR_RELAY_URLS': JSON.stringify(
            process.env.ERD_EDITOR_NOSTR_RELAY_URLS ?? ''
          ),
        },

    build: {
      // The repo's one browser floor, from build-target.ts. This transpiles
      // syntax only; the APIs the same ES2022 lib admits are what the legacy
      // plugin above polyfills.
      target: BROWSER_TARGET,
      sourcemap: true,
      rolldownOptions: {
        output: {
          /**
           * src/sw.ts routes on a hex-hash pattern to decide what is immutable
           * enough for CacheFirst, so hex digits and dot separators are a
           * contract with the service worker rather than a style choice.
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
     * Workers do not inherit build.rolldownOptions.output, so without this
     * their chunks land in assets/ with base64 hashes, which the service
     * worker's hex-hash route never matches.
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

    // erd-editor의 elk 워커가 동적으로 집는 commonjs 번들. dev 서버 스캐너는
    // 워커 엔트리를 걷지 않아서, 여기 적지 않으면 첫 정렬에서 의존성을 새로
    // 발견하고 페이지를 통째로 리로드한다 — 편집 중인 문서가 날아간다.
    optimizeDeps: {
      include: ['@dineug/erd-editor > elkjs/lib/elk.bundled.js'],
    },

    /**
     * nx.json targetDefaults의 대체. from에 셋을 다 적는 이유는 워크스페이스 의존이
     * 패키지마다 다른 필드에 있어서다 — 기본값에 맡기면 라이브러리 쪽 간선이 비고,
     * 그 결과는 실패가 아니라 stale dist를 상대로 한 초록이다.
     */
    run: {
      tasks: {
        build: {
          // 타입 게이트 ①. 배열은 순차 실행이자 독립 캐시 단위인데, 태스크 레벨
          // input은 두 서브태스크가 공유한다(실측) — 그래서 소스만 바뀌어도
          // 자동 추적에 안 잡히는 tsc가 다시 돈다.
          command: ['tsc --noEmit', 'vp build'],
          // Listed so the Google client id compiled into /gdrive reaches the
          // build and keys its cache; a task otherwise runs in a clean env.
          env: ['VITE_GOOGLE_CLIENT_ID'],
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
            { pattern: 'functions/**', base: 'workspace' },
            '!**/*.tsbuildinfo',
            '!dist/**',
          ],
          // 빠뜨리면 캐시 히트가 터미널 출력만 재생하고 산출물을 복원하지 않는다.
          output: ['dist/**'],
        },
        test: {
          // 타입 게이트 ②. vp test(built-in)는 run.tasks를 무시하므로 이 게이트를
          // 타지 않는다 — CI와 문서는 vp run test를 쓴다.
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
            { pattern: 'functions/**', base: 'workspace' },
            '!**/*.tsbuildinfo',
          ],
        },
      },
    },
  };
});
