import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { BROWSER_TARGET } from '../build-target.ts';
import {
  assertInlineWorkersEncoded,
  assertNoUrlWorkers,
  base64UrlLength,
  MAX_URL_LENGTH,
  readStringLiteral,
  rewriteInlineWorkers,
  rewriteUrlWorkers,
} from './vite/inline-worker.ts';
import {
  createLibraryConfig,
  createLibraryTasks,
  createWorkerOptions,
} from './vite/library-config.ts';
import {
  createExternal,
  loadLibraryMetadata,
} from './vite/package-metadata.ts';
import {
  assertWorkerUrlsRewritten,
  relativeWorkerUrl,
  rewriteWorkerUrls,
} from './vite/worker-url.ts';

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

test('package metadata derives the external policy', () => {
  const { manifest } = loadLibraryMetadata(rHtmlDir);

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
  assert.equal(config.build?.rolldownOptions?.output, undefined);

  const preserved = createLibraryConfig(rHtmlDir, {
    dts: () => ({ name: 'test-dts' }),
    minify: false,
    preserveModules: true,
  });
  assert.deepEqual(preserved.build?.rolldownOptions?.output, {
    preserveModules: true,
    preserveModulesRoot: join(rHtmlDir, 'src'),
  });
  assert.equal(preserved.build?.minify, false);
  const external = config.build?.rolldownOptions?.external;
  assert.ok(external instanceof RegExp);
  assert.equal(external.test('stylis'), true);
  assert.equal(external.test('stylis/lib/serializer'), true);
  assert.deepEqual(config.server, { open: false });
  assert.equal(config.worker, undefined);
});

test('a library that spawns a worker gets the shared worker build', () => {
  const external = /^stylis(?:\/.+)*$/;
  assert.deepEqual(createWorkerOptions(external), {
    format: 'es',
    rolldownOptions: {
      external,
      output: {
        entryFileNames: 'workers/[name].js',
        chunkFileNames: 'workers/[name]-[hash].js',
      },
    },
  });
  assert.deepEqual(createWorkerOptions(undefined).rolldownOptions, {
    output: {
      entryFileNames: 'workers/[name].js',
      chunkFileNames: 'workers/[name]-[hash].js',
    },
  });

  const config = createLibraryConfig(rHtmlDir, {
    dts: () => ({ name: 'test-dts' }),
    workers: true,
  });
  assert.equal(config.worker?.format, 'es');
  assert.ok(config.worker?.rolldownOptions?.external instanceof RegExp);
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

test('library worker urls become the one spelling every bundler resolves', () => {
  const emitted = `let e = new SharedWorker(new URL(
			/* @vite-ignore */
			"/workers/schemaGC.shared-worker.js",
			"" + import.meta.url
		), { type: "module", name: n });`;

  assert.equal(
    rewriteWorkerUrls(emitted, 'index.js'),
    `let e = new SharedWorker(new URL("./workers/schemaGC.shared-worker.js", import.meta.url), { type: "module", name: n });`
  );
  assert.equal(
    relativeWorkerUrl('engine/index.js', '/workers/schemaGC.shared-worker.js'),
    '../workers/schemaGC.shared-worker.js'
  );
  assert.equal(
    relativeWorkerUrl('assets/iframe-abc.js', '/assets/worker-def.js'),
    './worker-def.js'
  );

  const untouched = `new URL("./local.js", import.meta.url)`;
  assert.equal(rewriteWorkerUrls(untouched, 'index.js'), untouched);
});

test('inline shared workers are re-encoded to base64 under the url cap', () => {
  const chunk = `const jsContent = "self.onconnect = () => {};\\n";
export default function WorkerWrapper(options) {
  return new SharedWorker("data:text/javascript;charset=utf-8," + encodeURIComponent(jsContent), { name: options?.name });
}`;

  const rewritten = rewriteInlineWorkers(chunk);
  assert.ok(rewritten);
  assert.match(rewritten, /new SharedWorker\(__toDataUrl\(jsContent\)/);
  assert.match(rewritten, /function __toDataUrl\(source\)/);
  assert.equal(
    readStringLiteral(chunk, 'jsContent'),
    'self.onconnect = () => {};\n'
  );

  const twice = `var jsContent = "a";
var jsContent$1 = "b";
new SharedWorker("data:text/javascript;charset=utf-8," + encodeURIComponent(jsContent), o);
new SharedWorker("data:text/javascript;charset=utf-8," + encodeURIComponent(jsContent$1), o);`;
  const both = rewriteInlineWorkers(twice);
  assert.ok(both);
  assert.equal((both.match(/__toDataUrl\(/g) ?? []).length, 3);
  assert.doesNotMatch(both, /encodeURIComponent/);
  assert.equal(
    base64UrlLength('abcd'),
    'data:text/javascript;base64,'.length + 8
  );
  assert.equal(rewriteInlineWorkers('new Worker(url)'), null);
  assert.throws(
    () =>
      rewriteInlineWorkers(
        `new SharedWorker("data:text/javascript;charset=utf-8," + encodeURIComponent(missing))`
      ),
    /could not read/
  );
  assert.throws(
    () =>
      rewriteInlineWorkers(
        `const big = "${'x'.repeat(MAX_URL_LENGTH)}";\nnew SharedWorker("data:text/javascript;charset=utf-8," + encodeURIComponent(big))`
      ),
    /over the/
  );
});

test('an IDE webview turns dependency url workers into inline imports', () => {
  const id = '/repo/packages/erd-editor/dist/index.js';
  assert.ok(
    rewriteUrlWorkers(
      'new Worker(new URL("./workers/replicationStore.worker.js", import.meta.url), { type: "module" })',
      '/repo/packages/replication-store-worker/dist/index.js'
    )
  );
  const code = `let e = new SharedWorker(new URL("./workers/schemaGC.shared-worker.js", import.meta.url), { type: "module", name: n });
let w = new Worker(new URL("./workers/other.js", import.meta.url), { type: "module" });`;

  const rewritten = rewriteUrlWorkers(code, id);
  assert.ok(rewritten);
  assert.match(
    rewritten,
    /^import __inlineWorker0 from "\/repo\/packages\/erd-editor\/dist\/workers\/schemaGC\.shared-worker\.js\?sharedworker&inline";$/m
  );
  assert.match(
    rewritten,
    /^import __inlineWorker1 from "\/repo\/packages\/erd-editor\/dist\/workers\/other\.js\?worker&inline";$/m
  );
  assert.match(
    rewritten,
    /new __inlineWorker0\(\{ type: "module", name: n \}\)/
  );
  assert.match(rewritten, /new __inlineWorker1\(\{ type: "module" \}\)/);
  assert.doesNotMatch(rewritten, /import\.meta\.url/);

  assert.equal(
    rewriteUrlWorkers(code, '/repo/packages/app/src/index.ts'),
    null
  );
  assert.equal(rewriteUrlWorkers('const x = 1;', id), null);

  assert.match(
    rewriteUrlWorkers(
      'new Worker(new URL("./workers/bare.js", import.meta.url))',
      id
    ) ?? '',
    /new __inlineWorker0\(\)/
  );
  assert.match(
    rewriteUrlWorkers(
      `new SharedWorker(new URL("./workers/x.js", import.meta.url), {
\t\t\ttype: "module",
\t\t\tname: n
\t\t})`,
      id
    ) ?? '',
    /new __inlineWorker0\(\{\n\t\t\ttype: "module",/
  );
});

test('the rewrite plugins fail a build where their shape stopped matching', () => {
  assert.throws(
    () =>
      assertWorkerUrlsRewritten(
        'index.js',
        'new URL(/* @vite-ignore */ "/workers/x.js", "" + import.meta.url)'
      ),
    /survived the rewrite/
  );
  assert.doesNotThrow(() =>
    assertWorkerUrlsRewritten(
      'index.js',
      'new URL("./workers/x.js", import.meta.url)'
    )
  );
  assert.throws(
    () =>
      assertInlineWorkersEncoded(
        'bundle.js',
        'new SharedWorker(`data:text/javascript;charset=utf-8,${encodeURIComponent(x)}`)'
      ),
    /percent-encoded/
  );
  assert.doesNotThrow(() =>
    assertInlineWorkersEncoded('bundle.js', '"data:text/javascript;base64,"')
  );
  assert.throws(
    () =>
      assertNoUrlWorkers(
        'bundle.js',
        'new SharedWorker(new URL("/static/js/w.js", import.meta.url))'
      ),
    /survived into a host/
  );
  assert.doesNotThrow(() => assertNoUrlWorkers('bundle.js', 'new W(o)'));
});
