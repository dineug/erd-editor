import { readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { dirname, join } from 'node:path';

import { defineConfig, type Plugin } from 'vite-plus';

import { base64InlineWorkers } from '../../tools/vite/inline-worker.ts';

/** The dist files of the workspace packages that construct a worker from a url. */
const WORKER_HOSTS =
  /[\\/](erd-editor|(?:erd-editor-)?replication-store-worker)[\\/]dist[\\/].*\.js$/;

/** The one spelling those packages emit; the comma before the options goes with the url. */
const URL_WORKER =
  /new (SharedWorker|Worker)\(new URL\("(\.\.?\/[^"]+)", import\.meta\.url\)(?:,\s*|(?=\)))/g;

/**
 * Obsidian loads main.js alone, with no file beside it to spawn a worker from,
 * so every url worker in those dist files becomes Vite's inline worker: a
 * shared one as a data url, which base64InlineWorkers re-encodes, the replica as a blob.
 */
function inlineUrlWorkers(): Plugin {
  return {
    name: 'inline-url-workers',
    enforce: 'pre',
    transform(code, id) {
      if (!WORKER_HOSTS.test(id)) return null;

      const imports: string[] = [];
      const rewritten = code.replace(
        URL_WORKER,
        (_, kind: string, url: string) => {
          const query = kind === 'SharedWorker' ? 'sharedworker' : 'worker';
          const file = join(dirname(id), url);
          imports.push(
            `import __InlineWorker${imports.length} from ${JSON.stringify(`${file}?${query}&inline`)};`
          );
          return `new __InlineWorker${imports.length - 1}(`;
        }
      );
      if (!imports.length) return null;
      return { code: `${imports.join('\n')}\n${rewritten}`, map: null };
    },
    generateBundle(_, bundle) {
      for (const output of Object.values(bundle)) {
        if (
          output.type === 'chunk' &&
          /new (?:Shared)?Worker\(new URL\(/.test(output.code)
        ) {
          this.error(
            `a url worker in ${output.fileName} survived; its spelling changed`
          );
        }
      }
    },
  };
}

/** Puts manifest.json and styles.css beside main.js, so dist is the plugin folder. */
function pluginFiles(): Plugin {
  const files = ['manifest.json', 'styles.css'].map(name =>
    join(import.meta.dirname, name)
  );

  return {
    name: 'obsidian-plugin-files',
    buildStart() {
      files.forEach(file => this.addWatchFile(file));
    },
    generateBundle() {
      for (const file of files) {
        this.emitFile({
          type: 'asset',
          fileName: file.slice(import.meta.dirname.length + 1),
          source: readFileSync(file, 'utf8'),
        });
      }
    },
  };
}

export default defineConfig({
  // manifest.json and styles.css are emitted by pluginFiles; nothing else is static.
  publicDir: false,
  plugins: [inlineUrlWorkers(), base64InlineWorkers(), pluginFiles()],

  worker: {
    // Every worker is a module worker started from a data or blob url, so it
    // can neither call importScripts nor import a chunk by a relative path.
    format: 'es',
    rolldownOptions: {
      output: { codeSplitting: false },
    },
  },

  build: {
    lib: {
      entry: 'src/main.ts',
      formats: ['cjs'],
      fileName: () => 'main.js',
    },
    rolldownOptions: {
      // Obsidian loads main.js as CommonJS and provides these at runtime.
      external: [
        'obsidian',
        'electron',
        /^@codemirror\//,
        /^@lezer\//,
        ...builtinModules,
      ],
      output: { exports: 'default' },
    },
  },

  resolve: {
    alias: {
      '@': join(import.meta.dirname, 'src'),
    },
  },

  run: {
    tasks: {
      build: {
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
          'package.json',
          'vite.config.ts',
          'tsconfig.json',
          'manifest.json',
          'styles.css',
          { pattern: 'tsconfig.app.json', base: 'workspace' },
          { pattern: 'tools/vite/inline-worker.ts', base: 'workspace' },
          {
            pattern: 'packages/erd-editor/dist/**/*.d.ts',
            base: 'workspace',
          },
          {
            pattern: 'packages/replication-store-worker/dist/**/*.d.ts',
            base: 'workspace',
          },
          {
            pattern: 'packages/webview-bridge/dist/**/*.d.ts',
            base: 'workspace',
          },
          '!**/*.tsbuildinfo',
          '!dist/**',
        ],
        output: ['dist/**'],
      },
    },
  },
});
