import { readFileSync } from 'node:fs';
import { builtinModules, createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { defineConfig, type Plugin } from 'vite-plus';

const UMD_ID = '@dineug/erd-editor/umd';
const RESOLVED_UMD_ID = '\0erd-editor-umd';

/**
 * The UMD build carries its workers as data URLs; the ESM build spawns them
 * from import.meta.url, which a CommonJS main.js does not have. Its package is
 * type module, so the UMD is wrapped here to give it a CommonJS scope to fill.
 */
function erdEditorUmd(): Plugin {
  const umdPath = join(
    dirname(createRequire(import.meta.url).resolve('@dineug/erd-editor')),
    'erd-editor.umd.js'
  );

  return {
    name: 'erd-editor-umd',
    enforce: 'pre',
    resolveId: id => (id === UMD_ID ? RESOLVED_UMD_ID : null),
    load(id) {
      if (id !== RESOLVED_UMD_ID) return null;
      this.addWatchFile(umdPath);
      return [
        'const module = { exports: {} };',
        'const exports = module.exports;',
        '(function () {',
        readFileSync(umdPath, 'utf8'),
        '}).call(exports);',
        'export const { setExportFileCallback, setImportFileCallback } = module.exports;',
      ].join('\n');
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
  plugins: [erdEditorUmd(), pluginFiles()],

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
          {
            pattern: 'packages/erd-editor/dist/**/*.d.ts',
            base: 'workspace',
          },
          // Bundled whole by erdEditorUmd, not reached through an import.
          {
            pattern: 'packages/erd-editor/dist/erd-editor.umd.js',
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
