/// <reference types="vite/types/importMeta.d.ts" />
import { describe, expect, it, vi } from 'vite-plus/test';

import { imports } from '@/__test-utils__/imports';
import { erdEditorModule } from '@/erdEditorModule';

const editor = vi.hoisted(() => ({
  createKeyBindingMap: () => ({}),
  defineErdEditor: () => {},
  dictionaryRowChords: () => [],
  setExportFileCallback: () => {},
  setImportFileCallback: () => {},
  defineErdViewer: () => {},
  ErdEditorElement: class {},
  ErdViewerElement: class {},
}));

// The real package needs a window; the spec pins which of its members the plugin keeps.
vi.mock('@dineug/erd-editor', () => editor);

// A glob never matches the file that declares it, so this spec is left out of its own scan.
const sources = import.meta.glob<string>('./**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('erdEditorModule', () => {
  it('keeps the five members ErdEditorModule names, and nothing else of the package', () => {
    expect(erdEditorModule).toStrictEqual({
      createKeyBindingMap: editor.createKeyBindingMap,
      defineErdEditor: editor.defineErdEditor,
      dictionaryRowChords: editor.dictionaryRowChords,
      setExportFileCallback: editor.setExportFileCallback,
      setImportFileCallback: editor.setImportFileCallback,
    });
  });

  it('is the one module that imports the package root as a value', () => {
    const valueImports = Object.entries(sources).flatMap(([path, source]) =>
      imports(source)
        .filter(
          ({ module, typeOnly }) => module === '@dineug/erd-editor' && !typeOnly
        )
        .map(() => path)
    );

    expect(valueImports).toEqual(['./erdEditorModule.ts']);
  });

  it('reads type imports and subpaths of the package apart from the root', () => {
    expect(
      imports(
        [
          "import type { ErdEditorElement } from '@dineug/erd-editor';",
          "import { createPeerStore } from '@dineug/erd-editor/peer.js';",
          "const editor = require('@dineug/erd-editor');",
        ].join('\n')
      )
    ).toEqual([
      { module: '@dineug/erd-editor', typeOnly: true },
      { module: '@dineug/erd-editor/peer.js', typeOnly: false },
      { module: '@dineug/erd-editor', typeOnly: false },
    ]);
  });
});
