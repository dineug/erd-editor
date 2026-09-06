/// <reference types="node" />

// The editor registers <erd-editor> as it evaluates, and every other name it
// exports is a type. A file that creates the element while importing the type
// alone drops the import entirely and mounts an element nothing upgraded.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

const SOURCE_ROOT = join(process.cwd(), 'src');

const CREATES_ELEMENT = /createElement\(\s*'erd-editor'\s*\)/;

/** The import that carries the registration, and the only form that survives a build. */
const SIDE_EFFECT_IMPORT = /^import '@dineug\/erd-editor';$/m;

/** Where the element is built today, so a rename cannot leave the check matching nothing. */
const CALLERS = [
  'components/live-collaborative/LiveCollaborative.tsx',
  'components/viewer/editor/Editor.tsx',
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.test.ts')
      ? [path]
      : [];
  });
}

function callers(): string[] {
  return sourceFiles(SOURCE_ROOT)
    .filter(file => CREATES_ELEMENT.test(readFileSync(file, 'utf8')))
    .map(file => relative(SOURCE_ROOT, file).split(sep).join('/'))
    .sort();
}

describe('erd-editor registration', () => {
  it('covers every file that creates the element', () => {
    expect(callers()).toEqual(CALLERS);
  });

  it('is imported for its side effect by each of them', () => {
    const missing = callers().filter(
      file =>
        !SIDE_EFFECT_IMPORT.test(readFileSync(join(SOURCE_ROOT, file), 'utf8'))
    );

    expect(missing).toEqual([]);
  });
});
