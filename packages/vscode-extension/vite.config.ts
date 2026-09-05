import { builtinModules } from 'node:module';
import { relative } from 'node:path';

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
    // Derived from engines.vscode rather than guessed, by measuring the Node
    // that build's Electron ships. Targeting lower only costs downlevelling the
    // host never needed, and raising engines.vscode should raise this.
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
        // Map sources stay relative to the package rather than to dist/, so a
        // stack trace still points at src/extension.ts from wherever the VSIX
        // is unpacked.
        sourcemapPathTransform: (source, map) =>
          relative(
            import.meta.dirname,
            new URL(source, `file://${map}`).pathname
          ),
      },
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
          '!**/*.tsbuildinfo',
        ],
      },
    },
  },
});
