// Every DOM box a stylesheet lets scroll takes the scrollbar hook class, read
// from the sources: each style rule that scrolls, and each class list naming
// it, so a new scroller without the thin bar fails here rather than on sight.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

const SRC = join(process.cwd(), 'src');

const SCROLLS = /overflow(?:-x|-y)?:\s*(?:auto|scroll)\b/;

const IMPORT = /import \* as (\w+) from '([^']+\.styles)';/g;

const toKey = (path: string) => relative(SRC, path).split(sep).join('/');

const sources = (readdirSync(SRC, { recursive: true }) as string[])
  .map(file => join(SRC, file))
  .filter(
    file => /\.tsx?$/.test(file) && !/\.(test|test-d|stories)\.tsx?$/.test(file)
  );

/** Each exported style rule that lets its box scroll, as its file and name. */
function scrollingStyles(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of sources.filter(file => file.endsWith('.styles.ts'))) {
    const names = readFileSync(file, 'utf8')
      .split(/^export const /m)
      .slice(1)
      .filter(block => SCROLLS.test(block))
      .map(block => block.slice(0, block.search(/\W/)));
    if (names.length) found.set(toKey(file), names);
  }
  return found;
}

/** The class={...} expression around the index given, or null outside one. */
function classAround(text: string, index: number): string | null {
  const start = text.lastIndexOf('class={', index);
  if (start === -1) return null;
  let depth = 0;
  for (let at = start + 'class='.length; at < text.length; at++) {
    if (text[at] === '{') depth++;
    if (text[at] === '}' && --depth === 0) {
      return index < at ? text.slice(start, at + 1) : null;
    }
  }
  return null;
}

type Use = { file: string; style: string; hooked: boolean };

function usesOf(scrolling: Map<string, string[]>): Use[] {
  const uses: Use[] = [];
  for (const file of sources.filter(file => file.endsWith('.tsx'))) {
    const text = readFileSync(file, 'utf8');
    for (const [, alias, specifier] of text.matchAll(IMPORT)) {
      const styleFile = toKey(
        specifier.startsWith('@/')
          ? join(SRC, `${specifier.slice(2)}.ts`)
          : resolve(dirname(file), `${specifier}.ts`)
      );
      for (const name of scrolling.get(styleFile) ?? []) {
        for (const match of text.matchAll(
          new RegExp(`\\b${alias}\\.${name}\\b`, 'g')
        )) {
          const expression = classAround(text, match.index);
          uses.push({
            file: toKey(file),
            style: `${styleFile} ${name}`,
            hooked: expression?.includes("'scrollbar'") ?? false,
          });
        }
      }
    }
  }
  return uses;
}

describe('the scrollbar hook class', () => {
  const scrolling = scrollingStyles();
  const styles = [...scrolling].flatMap(([file, names]) =>
    names.map(name => `${file} ${name}`)
  );
  const uses = usesOf(scrolling);

  it('finds the style rules that let a box scroll', () => {
    expect(styles).toContain('components/primitives/tree/Tree.styles.ts root');
    expect(styles).toContain(
      'components/primitives/dialog/Dialog.styles.ts content'
    );
    expect(styles.length).toBeGreaterThanOrEqual(15);
  });

  it('finds a class list naming each of them', () => {
    const named = new Set(uses.map(use => use.style));
    expect(styles.filter(style => !named.has(style))).toEqual([]);
  });

  it('puts the scrollbar class in every class list naming one', () => {
    expect(
      uses.filter(use => !use.hooked).map(use => `${use.file}: ${use.style}`)
    ).toEqual([]);
  });
});
