import { builtinModules } from 'node:module';

import { defineConfig } from 'vite-plus';

/**
 * Everything the host does not ship stays external: vscode is injected and not
 * resolvable at build time, and the node builtins are present at runtime. Every
 * other dependency inlines, because the VSIX carries only this file.
 */
const external = [
  'vscode',
  ...builtinModules,
  ...builtinModules.map(name => `node:${name}`),
];

export default defineConfig({
  // public/ is not a static asset directory here: it is where the webview
  // package writes its bundle and the editor reads index.html from at runtime.
  // Vite would copy it into outDir, duplicating megabytes into the VSIX.
  publicDir: false,

  // build.ssr also makes Vite externalize anything resolved out of
  // node_modules, a rule the explicit list adds to rather than replaces, which
  // emits a bare require into a VSIX that ships no node_modules.
  ssr: {
    noExternal: true,
  },

  build: {
    // ssr puts Rolldown in Node resolution mode: no browser field, no
    // import.meta.env shimming, and require left alone.
    ssr: true,
    // Derived from engines.vscode, not guessed: 1.101.0 ships Electron 35.5.1
    // with Node 22.15.1 (ewanharris/vscode-versions). Targeting lower only
    // downlevels for a host that never needed it; raise this with the floor.
    target: 'node22',
    outDir: 'dist',
    emptyOutDir: true,
    // Effect inlines here, and unminified most of the bundle is its JSDoc. A
    // map of the minified bundle measures about 18x the bundle, so the VSIX
    // carries none.
    sourcemap: false,
    // Vite leaves an ssr build unminified; this alone strips it, and adding
    // rolldownOptions.output.minify as mcp-server does emits the same bytes.
    minify: true,
    lib: {
      entry: './src/extension.ts',
      formats: ['cjs'],
      fileName: () => 'extension.js',
    },
    rolldownOptions: {
      external,
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
          // tsconfig.unit.json typechecks the stubs too, out of sight of the tracer.
          'test/mocks/**',
          'vitest.config.*',
          'package.json',
          'vite.config.ts',
          'public/**',
          'tsconfig.json',
          'tsconfig.unit.json',
          { pattern: 'tsconfig.app.json', base: 'workspace' },
          {
            pattern: 'packages/agent-hub/dist/**/*.d.ts',
            base: 'workspace',
          },
          {
            pattern: 'packages/agent-hub-host/dist/**/*.d.ts',
            base: 'workspace',
          },
          {
            pattern: 'packages/webview-bridge/dist/**/*.d.ts',
            base: 'workspace',
          },
          '!**/*.tsbuildinfo',
          '!dist/**',
        ],
        // 빠뜨리면 캐시 히트가 터미널 출력만 재생하고 산출물을 복원하지 않는다.
        output: ['dist/**'],
      },
      test: {
        // 타입 게이트 ②. vp test(built-in)는 run.tasks를 무시하므로 이 게이트를
        // 타지 않는다 — CI와 문서는 vp run test를 쓴다.
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
          // tsconfig.unit.json typechecks the stubs too, out of sight of the tracer.
          'test/mocks/**',
          'vitest.config.*',
          'package.json',
          'vite.config.ts',
          'public/**',
          'tsconfig.json',
          'tsconfig.unit.json',
          { pattern: 'tsconfig.app.json', base: 'workspace' },
          {
            pattern: 'packages/agent-hub/dist/**/*.d.ts',
            base: 'workspace',
          },
          {
            pattern: 'packages/agent-hub-host/dist/**/*.d.ts',
            base: 'workspace',
          },
          {
            pattern: 'packages/webview-bridge/dist/**/*.d.ts',
            base: 'workspace',
          },
          '!**/*.tsbuildinfo',
        ],
      },
    },
  },
});
