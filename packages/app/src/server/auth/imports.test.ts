// @vitest-environment node
/// <reference types="node" />

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

// The Pages bundler follows whatever pages.ts imports, and workerd has neither
// Node's globals nor the DOM. The root tsc, which has no DOM lib, catches DOM
// names; this file catches what both programs would let through.

const PACKAGE_ROOT = process.cwd();
const SERVER_ROOT = join(PACKAGE_ROOT, 'src', 'server');
const ENTRY = join(SERVER_ROOT, 'auth', 'pages.ts');
const FUNCTIONS_ENTRY = join(
  PACKAGE_ROOT,
  '..',
  '..',
  'functions',
  'api',
  'auth',
  '[[route]].ts'
);

const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g;
const NODE_GLOBAL =
  /\b(?:Buffer|process|require|__dirname|__filename|global)\b/g;

/** Source without comments, which may well say process or require in prose. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(line => !line.trim().startsWith('//'))
    .join('\n');
}

function specifiers(source: string): string[] {
  return [...code(source).matchAll(SPECIFIER)].map(match => match[1]);
}

function nodeGlobals(source: string): string[] {
  return [...code(source).matchAll(NODE_GLOBAL)].map(match => match[0]);
}

function resolveImport(from: string, specifier: string): string {
  const base = resolve(dirname(from), specifier);
  const file = [base, `${base}.ts`, join(base, 'index.ts')].find(
    candidate => candidate.endsWith('.ts') && existsSync(candidate)
  );
  if (!file) throw new Error(`${specifier} does not resolve from ${from}`);
  return file;
}

/** Every file pages.ts reaches, with its source; bare specifiers are kept to fail on. */
function graph(entry: string): Map<string, string> {
  const files = new Map<string, string>();
  const pending = [entry];
  while (pending.length > 0) {
    const file = pending.pop() as string;
    if (files.has(file)) continue;
    const source = readFileSync(file, 'utf8');
    files.set(file, source);
    for (const specifier of specifiers(source)) {
      if (specifier.startsWith('.')) {
        pending.push(resolveImport(file, specifier));
      }
    }
  }
  return files;
}

const files = graph(ENTRY);
const names = [...files.keys()].map(file => relative(SERVER_ROOT, file));

describe('the Pages Functions graph', () => {
  it('reaches the relay from pages.ts, and not the dev adapter or a test', () => {
    expect(names).toEqual(
      expect.arrayContaining([
        join('auth', 'pages.ts'),
        join('auth', 'index.ts'),
        join('auth', 'handlers.ts'),
        join('auth', 'cookieCrypto.ts'),
      ])
    );
    expect(names).not.toContain(join('auth', 'nodeAdapter.ts'));
    expect(names.filter(name => name.endsWith('.test.ts'))).toEqual([]);
  });

  it.each(names)('%s imports only relative paths inside src/server', name => {
    const file = join(SERVER_ROOT, name);

    for (const specifier of specifiers(files.get(file) ?? '')) {
      expect(specifier).toMatch(/^\.\.?\//);
      const target = resolveImport(file, specifier);
      expect(target.startsWith(`${SERVER_ROOT}${sep}`)).toBe(true);
    }
  });

  it.each(names)('%s names no Node global and no type reference', name => {
    const source = files.get(join(SERVER_ROOT, name)) ?? '';

    expect(nodeGlobals(source)).toEqual([]);
    expect(source).not.toMatch(/^\/\/\/\s*<reference/m);
  });

  it('would catch a Node global, a bare import and a node: import', () => {
    expect(nodeGlobals("const bytes = Buffer.from('x', 'base64');")).toEqual([
      'Buffer',
    ]);
    expect(nodeGlobals('// process.env in a comment')).toEqual([]);
    expect(
      specifiers(
        "import { a } from './a';\nimport 'effect';\nconst b = await import('node:crypto');"
      )
    ).toEqual(['./a', 'effect', 'node:crypto']);
  });
});

describe('the Pages files', () => {
  it('keeps functions/api/auth/[[route]].ts a one-line re-export of pages.ts', () => {
    const source = readFileSync(FUNCTIONS_ENTRY, 'utf8');

    expect(source).toBe(
      "export { onRequest } from '../../../packages/app/src/server/auth/pages';\n"
    );
    expect(resolveImport(FUNCTIONS_ENTRY, specifiers(source)[0])).toBe(ENTRY);
  });

  it('routes /api/* alone to Functions', () => {
    const routes = JSON.parse(
      readFileSync(join(PACKAGE_ROOT, 'public', '_routes.json'), 'utf8')
    );

    expect(routes).toEqual({ version: 1, include: ['/api/*'], exclude: [] });
  });
});
