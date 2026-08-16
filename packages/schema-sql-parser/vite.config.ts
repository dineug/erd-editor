import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { defineConfig, lazyPlugins } from 'vite-plus';
import dts from 'vite-plugin-dts';
import { BROWSER_TARGET } from '../../build-target';

const pkg = JSON.parse(readFileSync('package.json', { encoding: 'utf8' }));

const banner = `/*!
 * ${pkg.name}
 * @version ${pkg.version} | ${new Date().toDateString()}
 * @author ${pkg.author}
 * @license ${pkg.license}
 */`;

export default defineConfig({
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
          'package.json',
          'tsconfig.json',
          'tsconfig.build.json',
          { pattern: 'tsconfig.app.json', base: 'workspace' },
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
          'package.json',
          'tsconfig.json',
          'tsconfig.build.json',
          { pattern: 'tsconfig.app.json', base: 'workspace' },
          '!**/*.tsbuildinfo',
        ],
      },
    },
  },
  build: {
    // 공개 라이브러리의 하한은 한 곳에서 온다 — 루트 `build-target.ts`.
    target: BROWSER_TARGET,
    lib: {
      entry: ['./src/index.ts'],
      formats: ['es'],
    },
    rolldownOptions: {
      output: {
        banner,
      },
    },
  },
  resolve: {
    alias: {
      '@': join(import.meta.dirname, 'src'),
    },
  },
  plugins: lazyPlugins(() => [
    dts({
      tsconfigPath: './tsconfig.build.json',
      compilerOptions: { declarationMap: true },
    }),
  ]),
});
