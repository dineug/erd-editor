// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

const srcDir = import.meta.dirname;

/** Every module the package ships: no spec, test helper or dev page. */
const shippingSources = (): Array<{ file: string; source: string }> =>
  readdirSync(srcDir, { recursive: true, encoding: 'utf8' })
    .filter(
      file =>
        file.endsWith('.ts') &&
        !file.endsWith('.test.ts') &&
        !file.startsWith('__test-utils__') &&
        file !== 'index.dev.ts'
    )
    .sort()
    .map(file => ({
      file,
      source: readFileSync(join(srcDir, file), 'utf8'),
    }));

/** The source with its comments blanked, so prose naming a global matches nothing. */
const codeOf = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

type Import = { specifier: string; typeOnly: boolean };

const STATIC_FORM =
  /^\s*(?:import|export)\s+(type\s+)?[^'";]*?from\s*(['"])([^'"]+)\2/gm;
const BARE_FORM = /^\s*import\s*(['"])([^'"]+)\1/gm;
const DYNAMIC_FORM = /\bimport\s*\(([^)]*)\)/g;
const LITERAL = /^\s*(['"])([^'"]+)\1\s*$/;

/**
 * Every import a module makes: a named or type import, a re-export, one made
 * for its side effect alone and an import() call, whose argument must be a
 * literal for its specifier to pass.
 */
const importsOf = (source: string): Import[] => {
  const code = codeOf(source);
  const found: Import[] = [];
  for (const [, typeOnly, , specifier] of code.matchAll(STATIC_FORM)) {
    found.push({ specifier, typeOnly: Boolean(typeOnly) });
  }
  for (const [, , specifier] of code.matchAll(BARE_FORM)) {
    found.push({ specifier, typeOnly: false });
  }
  for (const [, argument] of code.matchAll(DYNAMIC_FORM)) {
    const specifier = LITERAL.exec(argument)?.[2] ?? `computed ${argument}`;
    found.push({ specifier, typeOnly: false });
  }
  return found;
};

/** What the binding may load at run time, though it takes their types alone today; the editor is reached through its types alone. */
const RUNTIME_IMPORTS = new Set(['yjs', 'y-protocols/awareness']);
const TYPE_IMPORTS = new Set([
  '@dineug/erd-editor',
  '@dineug/erd-editor/peer.js',
]);

/** Browser globals the binding never reads, since its element binding calls the element alone. */
const DOM_GLOBALS =
  /\b(window|document|navigator|location|localStorage|sessionStorage|customElements|HTMLElement|SharedWorker|MutationObserver|requestAnimationFrame)\b/;

/** Built-ins past the browser floor, which no polyfill brings to a library's consumer. */
const ABOVE_FLOOR =
  /\bstructuredClone\b|\.at\(|\bObject\.hasOwn\b|\.findLast(Index)?\(|\.to(Sorted|Reversed|Spliced)\(|\brandomUUID\b|\bArray\.fromAsync\b|\bObject\.groupBy\b|\bPromise\.withResolvers\b/;

describe('shipping sources', () => {
  const sources = shippingSources();

  it('AC-P3 lists the modules it checks', () => {
    expect(sources.map(({ file }) => file)).toEqual([
      'awareness.ts',
      'binding.ts',
      'classify.ts',
      'compact.ts',
      'errors.ts',
      'index.ts',
      'json.ts',
      'log.ts',
      'port.ts',
      'snapshot.ts',
    ]);
  });

  it.each(sources)(
    'AC-P3 $file imports yjs, Awareness and the editor types alone, in any form',
    ({ source }) => {
      for (const { specifier, typeOnly } of importsOf(source)) {
        if (specifier.startsWith('@/')) continue;
        if (TYPE_IMPORTS.has(specifier)) {
          expect(typeOnly, specifier).toBe(true);
          continue;
        }
        expect(RUNTIME_IMPORTS.has(specifier), specifier).toBe(true);
      }
    }
  );

  it.each(sources)(
    'AC-P3 $file reads no browser global and no built-in past the floor',
    ({ source }) => {
      const code = codeOf(source).replace(/'[^'\n]*'|`[^`]*`/g, "''");
      expect(code).not.toMatch(DOM_GLOBALS);
      expect(code).not.toMatch(ABOVE_FLOOR);
    }
  );

  it('AC-P3 the checks see what they look for', () => {
    expect(importsOf("import { x } from 'lib0/random';")).toEqual([
      { specifier: 'lib0/random', typeOnly: false },
    ]);
    expect(importsOf('import { x } from "lib0/random";')).toEqual([
      { specifier: 'lib0/random', typeOnly: false },
    ]);
    expect(importsOf("import '@dineug/erd-editor/erd-editor.js';")).toEqual([
      { specifier: '@dineug/erd-editor/erd-editor.js', typeOnly: false },
    ]);
    expect(
      importsOf("const load = async () => await import('y-websocket');")
    ).toEqual([{ specifier: 'y-websocket', typeOnly: false }]);
    expect(importsOf('import(name);')).toEqual([
      { specifier: 'computed name', typeOnly: false },
    ]);
    expect(importsOf('import.meta.url;')).toEqual([]);
    expect(
      importsOf("import type { X } from '@dineug/erd-editor';")[0]
    ).toEqual({
      specifier: '@dineug/erd-editor',
      typeOnly: true,
    });
    expect('values.at(-1)').toMatch(ABOVE_FLOOR);
    expect('window.addEventListener').toMatch(DOM_GLOBALS);
  });
});
