import { join } from 'node:path';

import { defineConfig, type Plugin } from 'vite-plus';

/**
 * Strips `crossorigin` from the tags Vite injects.
 *
 * webpack emitted `<script defer src>`; Vite emits `<script type="module"
 * crossorigin>`, which asks the browser to make a CORS request. Inside a VSCode
 * webview the document runs on `vscode-webview://` while assets are served from
 * a different origin through `asWebviewUri`, and that origin does not answer
 * with the CORS headers a crossorigin module script requires.
 *
 * This is not covered by any test here. The Extension Host suite asserts the
 * editor resolves and the commands work, but the harness blocks the webview
 * document request itself (`Blocked vscode-webview request … index.html` in its
 * log), so a panel that fails to load its bundle still passes. Removing the
 * attribute costs nothing and closes a failure the suite cannot see.
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
 * This package builds *into another package*: `vuerd-vscode/public`, which the
 * extension reads at runtime and ships inside the VSIX. Three parts of the
 * output are contracts.
 *
 * `base: './'` — `Editor#buildHtmlForWebview` substitutes the webview URI into
 * `<base href="{{extension-base-url}}">` and lets relative asset URLs resolve
 * against it. Vite's default `/` would emit absolute paths, which resolve
 * against the webview origin instead and render a blank panel.
 *
 * The `{{extension-base-url}}` token has to survive HTML processing verbatim;
 * the extension replaces every occurrence with a regex, and a rewritten or
 * dropped `<base>` breaks every asset at once.
 *
 * Filenames stay `bundle.<hex8>.js` / `.css`. Rolldown hashes in base64 by
 * default, which is a different alphabet from webpack's `[contenthash:8]`.
 */
export default defineConfig({
  base: './',
  plugins: [stripCrossorigin()],
  // `index.html` is the entry and lives at the package root. There is no static
  // asset directory here, and leaving `publicDir` at its default would make
  // Vite look for one inside the output it is about to write.
  publicDir: false,

  build: {
    outDir: '../vscode-extension/public',
    // The output directory is outside this package's root, where Vite only
    // warns and declines to clear by default. Stale hashed bundles left there
    // are picked up by `vsce` and shipped — the directory already carried one
    // before this migration.
    emptyOutDir: true,
    // Preload links carry `crossorigin` too, and the extension has one entry —
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
   * nx.json `targetDefaults`의 대체. `dependsOn`이 `^build`를, `output`이
   * `outputs: ["{projectRoot}/dist"]`를 잇는다.
   *
   * `from`에 셋을 다 적는 이유: 이 레포의 워크스페이스 의존 간선은 **전부**
   * devDependencies에 있고 `dependencies`에는 하나도 없다. 기본값(`dependencies`)에
   * 맡기면 그래프가 통째로 비고, 그 결과는 실패가 아니라 stale dist를 상대로 한 초록이다.
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
