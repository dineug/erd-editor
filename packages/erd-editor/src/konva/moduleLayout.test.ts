// AC-G2 has two halves and both are filesystem facts: the konva host owns no
// context module of its own, and r-html's context system is untouched. It lives
// here because import.meta.glob in a .tsx file breaks the dependency scanner.

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

const KONVA_ROOT = join(process.cwd(), 'src', 'konva');

const CONTEXT_ROOT = join(process.cwd(), '..', 'r-html', 'src', 'context');

/**
 * What git ls-tree reports for packages/r-html/src/context at 3a524e6e, the
 * commit this transition branched from. A blob id hashes the file's own bytes,
 * so these are the ids a git diff of that directory compares against.
 */
const CONTEXT_BASELINE: Record<string, string> = {
  'createContext.test.ts': '221bdbe3e9145c8b3a157b03ddae97fcdf9391fb',
  'createContext.ts': 'ba5be9edf20188f713d76011fcb4cbd0fa785cb5',
  'useContext.test.ts': 'cdf19501d2de11bd40269942fe087fdec26a108f',
  'useContext.ts': '42aa8760f5fff321eaa2955a9a7fce2e85b8adc5',
  'useProvider.test.ts': 'eeec13c046d0093434d7d1793ec25fa985fdf591',
  'useProvider.ts': '165ea504db9bfd192dfe91d01e4681303aa3f176',
};

const isSpec = (file: string) => /\.(test|test-d)\.tsx?$/.test(file);

/** The id git would give these bytes, which no repository is needed to compute. */
const blobId = (content: Buffer) =>
  createHash('sha1')
    .update(`blob ${content.length}\0`)
    .update(content)
    .digest('hex');

describe('the konva host has no context module (AC-G2)', () => {
  it('has no context.ts', () => {
    expect(existsSync(join(KONVA_ROOT, 'context.ts'))).toBe(false);
  });

  it('has no context module under any other name', () => {
    const modules = readdirSync(KONVA_ROOT).filter(
      file => /^context.*\.tsx?$/.test(file) && !isSpec(file)
    );

    expect(modules).toEqual([]);
  });

  it('read the directory the host really lives in', () => {
    expect(readdirSync(KONVA_ROOT)).toContain('host.ts');
  });
});

describe('r-html keeps the context system it had (AC-G2)', () => {
  it('holds the files the baseline commit holds, and no others', () => {
    expect(readdirSync(CONTEXT_ROOT).sort()).toEqual(
      Object.keys(CONTEXT_BASELINE).sort()
    );
  });

  it('holds them byte for byte, which is a git diff of the directory empty', () => {
    const changed = Object.entries(CONTEXT_BASELINE)
      .filter(
        ([file, id]) => blobId(readFileSync(join(CONTEXT_ROOT, file))) !== id
      )
      .map(([file]) => file);

    expect(changed).toEqual([]);
  });
});
