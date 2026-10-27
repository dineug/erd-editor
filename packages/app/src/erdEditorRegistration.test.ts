/// <reference types="node" />

// The package's erd-editor.js and erd-viewer.js entries each register their tag
// as they evaluate. A file creating the element while importing only its type
// drops the import entirely and mounts an element nothing upgraded.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

const SOURCE_ROOT = join(process.cwd(), 'src');

/** A bare import of the package root, which no registration may rely on. */
const BARREL_IMPORT = /^import '@dineug\/erd-editor';$/m;

/**
 * Each element, the entry registering it, and where it is built today, so a
 * rename cannot leave a check matching nothing.
 */
const ELEMENTS = [
  {
    tag: 'erd-editor',
    entry: 'erd-editor.js',
    callers: [
      'components/gdrive/gdrive-editor/GdriveEditor.tsx',
      'components/live-collaborative/LiveCollaborative.tsx',
      'components/viewer/editor/Editor.tsx',
      'utils/convertSource.ts',
    ],
  },
  {
    tag: 'erd-viewer',
    entry: 'erd-viewer.js',
    callers: ['components/embed/embed-viewer/EmbedViewer.tsx'],
  },
];

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.test.ts')
      ? [path]
      : [];
  });
}

function callers(tag: string): string[] {
  const createsElement = new RegExp(
    `createElement\\(\\s*'${escape(tag)}'\\s*\\)`
  );

  return sourceFiles(SOURCE_ROOT)
    .filter(file => createsElement.test(readFileSync(file, 'utf8')))
    .map(file => relative(SOURCE_ROOT, file).split(sep).join('/'))
    .sort();
}

describe.each(ELEMENTS)(
  '$tag registration',
  ({ tag, entry, callers: expected }) => {
    /** The import that carries the registration, and the only form that survives a build. */
    const sideEffectImport = new RegExp(
      `^import '${escape(`@dineug/erd-editor/${entry}`)}';$`,
      'm'
    );

    it('covers every file that creates the element', () => {
      expect(callers(tag)).toEqual(expected);
    });

    it('is imported for its side effect by each of them', () => {
      const missing = callers(tag).filter(
        file =>
          !sideEffectImport.test(readFileSync(join(SOURCE_ROOT, file), 'utf8'))
      );

      expect(missing).toEqual([]);
    });
  }
);

describe('the package root', () => {
  it('is imported for its side effect by no file', () => {
    const barrelOnly = sourceFiles(SOURCE_ROOT)
      .filter(file => BARREL_IMPORT.test(readFileSync(file, 'utf8')))
      .map(file => relative(SOURCE_ROOT, file).split(sep).join('/'));

    expect(barrelOnly).toEqual([]);
  });
});
