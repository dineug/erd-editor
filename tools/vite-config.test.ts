import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { BROWSER_TARGET } from '../build-target.ts';
import {
  createBanner,
  createExternal,
  loadLibraryMetadata,
} from './vite/package-metadata.ts';
import {
  createLibraryConfig,
  createLibraryTasks,
} from './vite/library-config.ts';

const workspaceDir = join(import.meta.dirname, '..');
const editorDir = join(workspaceDir, 'packages/erd-editor');
const rHtmlDir = join(workspaceDir, 'packages/r-html');
const shikiWorkerDir = join(workspaceDir, 'packages/erd-editor-shiki-worker');

type CacheInput =
  | string
  | { auto: true }
  | { base?: string | null; pattern: string };
type LibraryTask = {
  command: string[];
  dependsOn?: unknown[];
  input: CacheInput[];
  output?: string[];
};
type LibraryTasks = { build: LibraryTask; test?: LibraryTask };
type Mutation = [label: string, mutate: (tasks: LibraryTasks) => void];

test('package metadata derives the banner and external policy', () => {
  const { manifest } = loadLibraryMetadata(rHtmlDir);

  assert.equal(
    createBanner(manifest),
    `/*!
 * @dineug/r-html
 * @version ${manifest.version} | ${new Date().toDateString()}
 * @author SeungHwan-Lee <dineug2@gmail.com>
 * @license MIT
 */`
  );

  const external = createExternal(manifest);
  assert.ok(external);
  assert.equal(external.test('stylis'), true);
  assert.equal(external.test('stylis/lib/serializer'), true);
  assert.equal(external.test('stylish'), false);
});

test('type-gate inputs come from tsconfig and workspace manifests', () => {
  const metadata = loadLibraryMetadata(editorDir);

  assert.deepEqual(metadata.typeGateInput, [
    { auto: true },
    'src/**',
    'vite.config.ts',
    'vitest.config.ts',
    'vitest.setup.ts',
    'tsconfig.build.json',
    'package.json',
    'tsconfig.json',
    { pattern: 'tsconfig.app.json', base: 'workspace' },
    { pattern: 'build-target.ts', base: 'workspace' },
    { pattern: 'tools/vite/**', base: 'workspace' },
    {
      pattern: 'packages/erd-editor-schema/dist/**/*.d.ts',
      base: 'workspace',
    },
    {
      pattern: 'packages/erd-editor-shiki-worker/dist/**/*.d.ts',
      base: 'workspace',
    },
    { pattern: 'packages/r-html/dist/**/*.d.ts', base: 'workspace' },
    {
      pattern: 'packages/schema-sql-parser/dist/**/*.d.ts',
      base: 'workspace',
    },
    { pattern: 'packages/shared/dist/**/*.d.ts', base: 'workspace' },
    {
      pattern: 'packages/vite-plugin-r-html/dist/**/*.d.ts',
      base: 'workspace',
    },
    '!**/*.tsbuildinfo',
  ]);
  assert.equal(metadata.hasTest, true);
  assert.equal(loadLibraryMetadata(shikiWorkerDir).hasTest, false);
});

test('standard library factory preserves build policies', () => {
  const config = createLibraryConfig(rHtmlDir, {
    banner: true,
    dts: () => ({ name: 'test-dts' }),
    server: { open: false },
  });
  const tasks = config.run?.tasks as LibraryTasks | undefined;
  const metadata = loadLibraryMetadata(rHtmlDir);

  assert.deepEqual(tasks?.build.command, ['tsc --noEmit', 'vp build']);
  assert.deepEqual(tasks?.test?.command, ['tsc --noEmit', 'vp test run']);
  assert.deepEqual(tasks?.build.dependsOn, tasks?.test?.dependsOn);
  assert.deepEqual(tasks?.build.output, ['dist/**']);
  assert.deepEqual(tasks?.build.input, [...metadata.typeGateInput, '!dist/**']);
  assert.deepEqual(tasks?.test?.input, metadata.typeGateInput);
  assert.deepEqual(config.build?.target, BROWSER_TARGET);
  assert.deepEqual(config.build?.lib, {
    entry: ['./src/index.ts'],
    formats: ['es'],
  });
  const output = config.build?.rolldownOptions?.output as
    | { banner?: string }
    | undefined;
  assert.equal(output?.banner, createBanner(metadata.manifest));
  const external = config.build?.rolldownOptions?.external;
  assert.ok(external instanceof RegExp);
  assert.equal(external.test('stylis'), true);
  assert.equal(external.test('stylis/lib/serializer'), true);
  assert.deepEqual(config.server, { open: false });
});

test('build-only packages do not grow a test task', () => {
  assert.deepEqual(Object.keys(createLibraryTasks(shikiWorkerDir)), ['build']);
});

test('task metadata does not require generated workspace plugins', () => {
  const config = readFileSync(join(editorDir, 'vite.config.ts'), 'utf8');

  assert.doesNotMatch(config, /from ['"]@dineug\/vite-plugin-r-html['"]/);
  assert.doesNotMatch(config, /import\(['"]@dineug\/vite-plugin-r-html['"]\)/);
  assert.match(
    config,
    /const rHtmlPackage: string = ['"]@dineug\/vite-plugin-r-html['"]/
  );
  assert.match(config, /await import\(rHtmlPackage\)/);
});

test('required task contracts reject cache-gate mutations', () => {
  const mutations: Mutation[] = [
    [
      'factory input',
      tasks => {
        tasks.build.input = tasks.build.input.filter(
          entry =>
            typeof entry === 'string' ||
            !('pattern' in entry) ||
            entry.pattern !== 'tools/vite/**'
        );
      },
    ],
    [
      'workspace declaration input',
      tasks => {
        tasks.build.input = tasks.build.input.filter(
          entry =>
            typeof entry === 'string' ||
            !('pattern' in entry) ||
            entry.pattern !== 'packages/erd-editor-schema/dist/**/*.d.ts'
        );
      },
    ],
    [
      'type gate',
      tasks => {
        tasks.build.command = ['vp build'];
      },
    ],
    [
      'dist exclusion',
      tasks => {
        tasks.build.input = tasks.build.input.filter(
          entry => entry !== '!dist/**'
        );
      },
    ],
    [
      'build output',
      tasks => {
        tasks.build.output = [];
      },
    ],
  ];

  for (const [label, mutate] of mutations) {
    const tasks = createLibraryTasks(editorDir);
    assert.ok(tasks.build);
    assert.ok(tasks.test);
    const typedTasks = tasks as LibraryTasks;
    mutate(typedTasks);
    assert.throws(() => assertRequiredTaskContracts(typedTasks), label);
  }
});

function assertRequiredTaskContracts(tasks: LibraryTasks) {
  const metadataInput = loadLibraryMetadata(editorDir).typeGateInput;
  assert.deepEqual(tasks.test?.input, metadataInput);
  assert.deepEqual(tasks.build.input, [...metadataInput, '!dist/**']);
  assert.equal(tasks.build.command[0], 'tsc --noEmit');
  assert.deepEqual(tasks.build.output, ['dist/**']);
}
