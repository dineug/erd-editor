import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import typescript from '@rollup/plugin-typescript';
import { defineConfig, lazyPlugins } from 'vite-plus';
import dts from 'vite-plugin-dts';

const pkg = JSON.parse(readFileSync('package.json', { encoding: 'utf8' }));

const banner = `/*!
 * ${pkg.name}
 * @version ${pkg.version} | ${new Date().toDateString()}
 * @author ${pkg.author}
 * @license ${pkg.license}
 */`;

/**
 * Runtime dependencies stay out of the bundle. Vite's library mode does not externalize them on
 * its own, so without this every consumer that bundles `dist/` would inline its own copy.
 * Derived from `package.json` so a new dependency is externalized without touching this file.
 *
 * A regex rather than the bare name list the other library packages settled on, because a plain
 * array matches the package specifier and nothing else: the day something imports `stylis/foo`,
 * that subpath is bundled while the root import stays external and the consumer ships two copies.
 * Nothing imports a subpath today, which is why the emitted bundle is unchanged by this.
 */
const external = new RegExp(
  `^(${Object.keys(pkg.dependencies ?? {}).join('|')})(?:/.+)*$`
);

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
    lib: {
      entry: ['./src/index.ts'],
      formats: ['es'],
    },
    rolldownOptions: {
      external,
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
    typescript({
      tsconfig: './tsconfig.build.json',
      noEmitOnError: true,
      noForceEmit: true,
    }),
  ]),
  server: {
    // `vp dev` has no `--no-open`, so the e2e run turns this off through the
    // environment instead of a CLI flag — the same shape erd-editor already uses.
    open: !process.env.E2E,
  },
});
