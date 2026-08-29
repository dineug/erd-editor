import { builtinModules } from 'node:module';
import { relative } from 'node:path';

import { defineConfig } from 'vite-plus';

/**
 * The extension host loads this bundle with `require`, from a `main` field that
 * carries no extension: `"./dist/extension"`. Node resolves that to
 * `dist/extension.js` and nothing else, so the emitted filename is a contract,
 * not a preference — a default `.cjs` here means the extension does not
 * activate at all.
 *
 * Everything the host does not ship stays external. `vscode` is injected by the
 * host and is not resolvable at build time; the node builtins are present at
 * runtime and bundling them would be wrong even where it is possible. Every
 * other dependency is inlined — the VSIX carries only this file, so a surviving
 * `require` of an npm package fails activation outright.
 */
const external = [
  'vscode',
  ...builtinModules,
  ...builtinModules.map(name => `node:${name}`),
];

export default defineConfig({
  // `public/` here is not a static asset directory — it is where
  // `@dineug/erd-editor-vscode-webview` writes its bundle, and `Editor#
  // buildHtmlForWebview` reads `public/index.html` from there at runtime. Vite
  // copies `publicDir` into `outDir` on build, so leaving this at its default
  // duplicates 2.6MB of webview into `dist/` and into the VSIX.
  publicDir: false,

  // `build.ssr` puts Rolldown in Node resolution mode, and that mode also makes
  // Vite externalize anything resolved out of `node_modules` on its own — a
  // rule `rolldownOptions.external` adds to rather than replaces. Workspace
  // siblings are symlinked and stay inlined either way, so the only packages it
  // caught were the real ones (`base64-arraybuffer`), emitted as a bare
  // `require` into a VSIX that ships no `node_modules`. `noExternal` turns that
  // off; the list above remains the whole of what stays external.
  ssr: {
    noExternal: true,
  },

  build: {
    // `ssr` puts Rolldown in Node resolution mode: no browser field, no
    // `import.meta.env` shimming, and `require` left alone.
    ssr: true,
    // Derived from `engines.vscode: ^1.90.0`, not guessed: that build runs
    // Electron 29.4.0 / Node 20.9.0, measured by running its own binary with
    // `ELECTRON_RUN_AS_NODE=1`. Targeting lower only costs downlevelling the
    // host never needed. Raising `engines.vscode` should raise this with it.
    target: 'node20',
    outDir: 'dist',
    emptyOutDir: true,
    // Vite defaults this to false. The VSIX has always carried a 32KB map and
    // the Extension Host reads it when a stack trace crosses this file.
    sourcemap: true,
    lib: {
      entry: './src/extension.ts',
      formats: ['cjs'],
      fileName: () => 'extension.js',
    },
    rolldownOptions: {
      external,
      output: {
        // webpack wrote `devtoolModuleFilenameTemplate: '../[resource-path]'`,
        // which makes map sources relative to the package rather than to
        // `dist/`. Keeping that means a stack trace still points at
        // `src/extension.ts` from wherever the VSIX is unpacked.
        sourcemapPathTransform: (source, map) =>
          relative(
            import.meta.dirname,
            new URL(source, `file://${map}`).pathname
          ),
      },
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
        command: ['tsc -p tsconfig.unit.json --noEmit', 'vp build'],
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
          'package.json',
          'vite.config.ts',
          'public/**',
          'tsconfig.json',
          'tsconfig.unit.json',
          { pattern: 'tsconfig.app.json', base: 'workspace' },
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
      test: {
        // 타입 게이트 ②. `vp test`(built-in)는 run.tasks를 무시하므로 이 게이트를
        // 타지 않는다 — CI와 문서는 `vp run test`를 쓴다.
        command: ['tsc -p tsconfig.unit.json --noEmit', 'vp test run'],
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
          'package.json',
          'vite.config.ts',
          'public/**',
          'tsconfig.json',
          'tsconfig.unit.json',
          { pattern: 'tsconfig.app.json', base: 'workspace' },
          {
            pattern: 'packages/vscode-bridge/dist/**/*.d.ts',
            base: 'workspace',
          },
          { pattern: 'packages/shared/dist/**/*.d.ts', base: 'workspace' },
          '!**/*.tsbuildinfo',
        ],
      },
    },
  },
});
