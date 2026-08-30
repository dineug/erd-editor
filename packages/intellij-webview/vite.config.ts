import { join } from 'node:path';

import { defineConfig, type Plugin } from 'vite-plus';

/**
 * Strips crossorigin from the tags Vite injects. The IDE serves these assets
 * through a custom CEF scheme handler that returns a body and a MIME type and
 * no CORS headers, so a crossorigin module script is refused.
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

export default defineConfig({
  base: '/',
  plugins: [stripCrossorigin()],
  // index.html is the entry and sits at the package root; there is no static
  // asset directory to copy.
  publicDir: false,

  build: {
    outDir: '../intellij-plugin/src/main/resources/assets',
    // The output directory is outside this package's root, where Vite only
    // warns and declines to clear by default. Stale hashed bundles left there
    // are packaged into the plugin jar.
    emptyOutDir: true,
    // webpack emitted no sourcemap in production, and .map is outside the
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
   * src/main.ts constructs a module worker, and Vite's default iife format
   * code-splits through importScripts, which a module worker cannot call.
   * Workers inherit no output options either, so the naming repeats here.
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
        ],
        // 이 패키지는 자기 밖에 쓴다 — Gradle이 그 산출물을 클래스패스 리소스로
        // 싣는다. 빠뜨리면 캐시 히트가 터미널 출력만 재생하고 산출물을 복원하지
        // 않는다.
        output: [
          {
            pattern: 'packages/intellij-plugin/src/main/resources/assets/**',
            base: 'workspace',
          },
        ],
      },
    },
  },
});
