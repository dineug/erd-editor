import { join } from 'node:path';

import { defineConfig, type Plugin } from 'vite-plus';

/**
 * Strips crossorigin from the tags Vite injects. A webview document runs on one
 * origin while asWebviewUri serves assets from another, which answers with none
 * of the CORS headers a crossorigin module script requires.
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
  base: './',
  plugins: [stripCrossorigin()],
  // index.html is the entry and lives at the package root. There is no static
  // asset directory here, and leaving publicDir at its default would make
  // Vite look for one inside the output it is about to write.
  publicDir: false,

  build: {
    outDir: '../vscode-extension/public',
    // The output directory is outside this package's root, where Vite only
    // warns and declines to clear by default, so stale hashed bundles left
    // there are picked up by vsce and shipped.
    emptyOutDir: true,
    // Preload links carry crossorigin too, and the extension has one entry —
    // there is nothing for the browser to usefully preload here anyway.
    modulePreload: false,
    rolldownOptions: {
      output: {
        hashCharacters: 'hex',
        entryFileNames: 'bundle.[hash:8].js',
        chunkFileNames: '[name].[hash:8].js',
        assetFileNames: 'bundle.[hash:8][extname]',
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
          'index.html',
          'package.json',
          'vite.config.ts',
          'tsconfig.json',
          { pattern: 'tsconfig.app.json', base: 'workspace' },
          { pattern: 'packages/erd-editor/dist/**/*.d.ts', base: 'workspace' },
          {
            pattern: 'packages/erd-editor-shiki-worker/dist/**/*.d.ts',
            base: 'workspace',
          },
          {
            pattern: 'packages/vscode-bridge/dist/**/*.d.ts',
            base: 'workspace',
          },
          {
            pattern: 'packages/vscode-replication-store-worker/dist/**/*.d.ts',
            base: 'workspace',
          },
          { pattern: 'packages/shared/dist/**/*.d.ts', base: 'workspace' },
          '!**/*.tsbuildinfo',
          '!dist/**',
        ],
        // 이 패키지는 자기 밖에 쓴다 — vuerd-vscode가 그 산출물을 VSIX에 싣는다.
        output: [
          { pattern: 'packages/vscode-extension/public/**', base: 'workspace' },
        ],
      },
    },
  },
});
