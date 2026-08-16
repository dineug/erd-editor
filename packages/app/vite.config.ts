import { defineConfig } from 'vite-plus';

/**
 * 이 패키지는 webpack이 번들한다. 이 파일이 존재하는 이유는 하나 —
 * `vp run`이 태스크를 발견할 자리를 주는 것이다. 번들러 설정은
 * `webpack.config.js`가 계속 소유한다.
 */
export default defineConfig({
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
        command: ['tsc --noEmit', 'webpack --mode production'],
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
          'webpack.config.js',
          'public/**',
          'tsconfig.json',
          { pattern: 'tsconfig.app.json', base: 'workspace' },
          { pattern: 'packages/erd-editor/dist/**/*.d.ts', base: 'workspace' },
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
          'webpack.config.js',
          'public/**',
          'tsconfig.json',
          { pattern: 'tsconfig.app.json', base: 'workspace' },
          { pattern: 'packages/erd-editor/dist/**/*.d.ts', base: 'workspace' },
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
});
