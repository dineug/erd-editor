import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, parse as parsePath } from 'node:path';

import { compile as stylisCompile, serialize, stringify } from 'stylis';
import { describe, expect, it } from 'vite-plus/test';

import { compile } from '@/css/compile';

/**
 * Characterization suite for the stylis 4.4.0 behaviour `@dineug/r-html` depends on.
 *
 * We consume stylis as a dependency, so this is not a correctness proof of our own parser — there
 * isn't one. It serves two other purposes:
 *
 * 1. **It pins the argument threading in `compile()`.** Our wrapper calls stylis' `parse()` directly
 *    rather than its `compile()`, so that it can seed the parent selector list and the synthetic
 *    scope rule. Passing nine positional arguments by hand is exactly the kind of thing that is
 *    silently wrong, so the unseeded path is asserted to be indistinguishable from stylis' own
 *    `compile()` over a broad corpus.
 *
 * 2. **It is the upgrade gate.** stylis is pinned to 4.4.0. When that pin moves, whatever this
 *    corpus stops agreeing on is the behaviour our compiler layers were relying on.
 *
 * Both checks run over every row — twice:
 *
 * - **Structurally**, on the whole tree: `value` / `type` / `props` / `children` plus `line` /
 *   `column` / `length` / `return`. This catches differences serialization hides — two different
 *   trees can both serialize to `''`.
 * - **Byte-for-byte after serialization**, using stylis' own `serialize`/`stringify`.
 *
 * Order matters: `stringify` mutates the nodes it visits (it memoizes into `element.return` and
 * rewrites `element.value` from `element.props` for a RULESET), so the structural comparison has to
 * happen before anything is serialized.
 */

type UnknownElement = {
  value: string;
  type: string;
  props: unknown;
  children: unknown;
  line: number;
  column: number;
  length: number;
  return: string;
  root: unknown;
  parent: unknown;
};

type NormalizedElement = {
  value: string;
  type: string;
  props: string | string[];
  children: string | NormalizedElement[];
  line: number;
  column: number;
  length: number;
  return: string;
};

function normalize(node: UnknownElement): NormalizedElement {
  return {
    value: node.value,
    type: node.type,
    props: Array.isArray(node.props)
      ? (node.props.slice() as string[])
      : (node.props as string),
    children: Array.isArray(node.children)
      ? (node.children as UnknownElement[]).map(normalize)
      : (node.children as string),
    line: node.line,
    column: node.column,
    length: node.length,
    return: node.return,
  };
}

function normalizeAll(nodes: UnknownElement[]): NormalizedElement[] {
  return nodes.map(normalize);
}

function indexTree(
  nodes: UnknownElement[],
  prefix: string,
  index: Map<unknown, string>
) {
  nodes.forEach((node, i) => {
    const path = `${prefix}${i}`;
    index.set(node, path);
    if (Array.isArray(node.children)) {
      indexTree(node.children as UnknownElement[], `${path}/`, index);
    }
  });
}

/**
 * `root` and `parent` are object references, so `toEqual` would recurse into them forever (and
 * compare by value rather than by identity). Reducing each reference to the path of the node it
 * points at compares the *graph* instead: same shape, same wiring.
 */
function linkage(nodes: UnknownElement[]): string[] {
  const index = new Map<unknown, string>();
  indexTree(nodes, '', index);

  const out: string[] = [];
  const where = (ref: unknown) =>
    ref === null || ref === undefined ? 'null' : (index.get(ref) ?? 'external');

  const walk = (list: UnknownElement[]) => {
    for (const node of list) {
      out.push(
        `${index.get(node)} root=${where(node.root)} parent=${where(node.parent)}`
      );
      if (Array.isArray(node.children)) {
        walk(node.children as UnknownElement[]);
      }
    }
  };
  walk(nodes);

  return out;
}

function expectEquivalent(input: string) {
  const ours = compile(input) as unknown as UnknownElement[];
  const theirs = stylisCompile(input) as UnknownElement[];

  expect(normalizeAll(ours)).toEqual(normalizeAll(theirs));
  expect(linkage(ours)).toEqual(linkage(theirs));

  expect(serialize(ours as any, stringify)).toBe(
    serialize(theirs as any, stringify)
  );
}

const COLOR_PICKER_STYLE = join(
  'packages',
  'erd-editor',
  'src',
  'styles',
  'colorPicker.style.ts'
);

/**
 * Resolves a workspace-relative path by walking up from the current working directory.
 *
 * The `happy-dom` environment leaves `import.meta.url` as a non-`file:` URL, so the usual
 * `fileURLToPath(new URL(..., import.meta.url))` is unavailable here; walking up also keeps the
 * lookup independent of whether the suite was started from the package or from the repo root.
 */
function resolveFromWorkspace(relative: string): string {
  const { root } = parsePath(process.cwd());
  let dir = process.cwd();

  for (;;) {
    const candidate = join(dir, relative);
    if (existsSync(candidate)) return candidate;
    if (dir === root) break;
    dir = dirname(dir);
  }

  throw new Error(`Could not locate "${relative}" from ${process.cwd()}`);
}

const CORPUS: Array<[label: string, input: string]> = [
  // --- flat declarations -------------------------------------------------------------------
  ['empty input', ''],
  ['whitespace only', '  \n\t  '],
  ['single declaration', '.a{color:red}'],
  ['trailing semicolon', '.a{color:red;}'],
  ['multiple declarations', '.a{color:red;background:blue;margin:0}'],
  [
    'two rules, first has no trailing semicolon',
    '.a{color:red}\n.b{color:blue;}',
  ],
  ['space around the colon', '.a{color : red;}'],
  ['declaration with an empty value', '.a{color:}'],
  ['declaration without a colon', '.a{color red}'],
  ['top level declaration', 'color:red;'],
  ['empty block', '.a{}'],
  ['block of whitespace', '.a{   }'],
  ['double semicolons', '.a{color:red;;background:blue}'],
  ['!important', '.a{color:red!important}'],
  [
    'vendor prefixed property is passed through',
    '.a{-webkit-box-shadow:0 0 1px #000}',
  ],
  ['tabs inside the block', '.a{\tcolor:red\t}'],
  ['CRLF line endings', '.a{color:red;\r\n.b{color:blue}}'],

  // --- comments ----------------------------------------------------------------------------
  ['block comment between rules', '.a{color:red}/* hi */.b{color:blue}'],
  ['block comment inside a block', '.a{/* c */color:red}'],
  ['empty block comment', '/**/.a{color:red}'],
  ['block comment containing braces', '.a{/* { } */color:red}'],
  ['block comment containing a star', '/* ** */.a{c:d}'],
  ['line comment inside a block', '.a{color:red;// note\nbackground:blue}'],
  ['line comment at the top level', '// top\n.a{color:red}'],
  [
    'the %/ quirk inside a line comment',
    '.a{color:red;// 50%/50% ratio\nbackground:blue}',
  ],
  ['%/ at the very start of a line comment', '.a{//%/ x\ncolor:red}'],
  ['unterminated block comment', '.a{color:red;/* never closed'],
  ['comments around every rule', '/*a*/.a{x:1}/*b*/.b{y:2}/*c*/'],

  // --- nesting -----------------------------------------------------------------------------
  ['&:hover', '.a{&:hover{color:red}}'],
  ['& + &', '.a{& + &{color:red}}'],
  ['.x & (parent last)', '.a{.x &{color:red}}'],
  ['&&', '.a{&&{color:red}}'],
  ['&.mod', '.a{&.mod{color:red}}'],
  ['&-suffix', '.a{&-suffix{color:red}}'],
  [':is(&, &)', '.a{:is(&, &){color:red}}'],
  ['bare nested rule', '.a{.b{color:red}}'],
  ['three levels deep', '.a{.b{.c{color:red}}}'],
  [
    'declarations either side of a nested rule',
    '.a{color:red;.b{color:blue}margin:0}',
  ],
  ['nested combinator without &', '.a{> .b{color:red}}'],
  ['& inside a nested at-rule', '.a{@media screen{&:hover{color:red}}}'],

  // --- selector lists ----------------------------------------------------------------------
  ['selector list at the top level', '.p, .q{color:red}'],
  ['cartesian product of two lists', '.p, .q{a, b{color:red}}'],
  ['nested list of & selectors', '.p, .q{&:hover, &:focus{color:red}}'],
  ['trailing comma in a list', '.a, {color:red}'],
  ['list broken across newlines', '.a,\n.b\n{color:red}'],
  ['child combinator', '.a>.b{color:red}'],
  ['sibling combinator', '.a~.b{color:red}'],

  // --- pseudo classes and elements ---------------------------------------------------------
  ['::before', '.a::before{content:""}'],
  ['::slotted(x)', '::slotted(x){color:red}'],
  [':not(:is(.b))', '.a:not(:is(.b)){color:red}'],
  [':host', ':host{display:block}'],
  [':host(.dark)', ':host(.dark){color:white}'],
  [':host-context(.dark)', ':host-context(.dark) .a{color:white}'],
  [':nth-child(2n+1)', 'li:nth-child(2n+1){color:red}'],
  ['::part(label)', '.a::part(label){color:red}'],

  // --- attribute selectors -----------------------------------------------------------------
  ['attribute, unquoted value', '[data-x=y]{color:red}'],
  ['attribute, double quoted value', '[data-x="y z"]{color:red}'],
  ['attribute value containing a brace', '[data-x="{"]{color:red}'],
  ['attribute value containing a semicolon', '[data-x="a;b"]{color:red}'],
  ['attribute, single quoted value', "[data-x='y']{color:red}"],
  ['attribute with a case-insensitivity flag', '[data-x="Y" i]{color:red}'],

  // --- strings, url(), calc() --------------------------------------------------------------
  ['string containing braces', '.a{content:"{}"}'],
  ['string containing a semicolon', '.a{content:"a;b";color:red}'],
  ['string containing parens', '.a{content:"(a)"}'],
  ['string containing an escaped quote', '.a{content:"a\\"b"}'],
  [
    'url() with a data URI and a semicolon',
    '.a{background:url(data:image/svg+xml;base64,AAA)}',
  ],
  ['url() quoted, containing a semicolon', '.a{background:url("a;b.png")}'],
  ['url() unquoted with a slash', '.a{background:url(a/b.png)}'],
  ['url() with a scheme colon', '.a{background:url(http://x/y.png)}'],
  ['calc() with nested parens', '.a{width:calc((100% - 10px)/2)}'],
  ['nested functions', '.a{color:rgba(var(--r), 0, 0, .5)}'],
  ['space after a closing paren', '.a{margin:calc(1px) 2px}'],
  ['space after a closing bracket', '[a] .b{color:red}'],
  ['space after an unmatched closing paren', '.a{color:red) 1px}'],
  ['multiple strings in one value', '.a{grid-template-areas:"a b" "c d"}'],

  // --- custom properties -------------------------------------------------------------------
  ['custom property with a block value', '.a{--x: {a:b}}'],
  ['custom property with an empty value', '.a{--x:;}'],
  [
    'custom property with a braced value then a declaration',
    '.a{--x:{a:b;c:d};color:red}',
  ],
  ['custom property on :root', ':root{--x:1px}'],
  ['custom property with nested braces', '.a{--x:{b:{c:d}};color:red}'],
  [
    'custom property whose braces close across newlines',
    '.a{--x:{b:{c:d}\n}\n;color:red}',
  ],
  ['var() with a fallback', '.a{color:var(--x, red)}'],
  ['var() with a nested fallback', '.a{color:var(--x, var(--y, blue))}'],

  // --- at-rules ----------------------------------------------------------------------------
  ['@media', '@media(max-width:100px){.a{color:red}}'],
  [
    '@media screen (the space must survive)',
    '@media screen and (min-width:100px){.a{color:red}}',
  ],
  ['@media with a query list', '@media screen, print{.a{color:red}}'],
  ['@supports', '@supports (display:grid){.a{display:grid}}'],
  ['@container anonymous', '@container (min-width:100px){.a{color:red}}'],
  ['@container named', '@container card (min-width:100px){.a{color:red}}'],
  ['@layer statement', '@layer a, b;'],
  ['@layer block', '@layer base{.a{color:red}}'],
  ['@layer empty block', '@layer a{}'],
  ['@keyframes from/to', '@keyframes k{from{opacity:0}to{opacity:1}}'],
  [
    '@keyframes percentages',
    '@keyframes k{0%{opacity:0}50%{opacity:.5}100%{opacity:1}}',
  ],
  [
    'vendor prefixed at-rule (@- path)',
    '@-webkit-keyframes k{from{opacity:0}to{opacity:1}}',
  ],
  ['& inside an at-rule prelude', '@media a&b{.x{color:red}}'],
  ['@font-face', '@font-face{font-family:X;src:url(x.woff2)}'],
  ['@font-face with a unicode-range', '@font-face{unicode-range:U+0-7F}'],
  ['@page', '@page{margin:1cm}'],
  ['@page :first', '@page :first{margin:2cm}'],
  ['@import', '@import url("a.css");'],
  ['@import with a media query', '@import "a.css" screen;'],
  ['@charset', '@charset "utf-8";'],
  ['@namespace', '@namespace svg url(http://www.w3.org/2000/svg);'],
  ['@document', '@document url("http://x") {.a{color:red}}'],
  ['@viewport', '@viewport{width:device-width}'],
  ['@counter-style', '@counter-style x{system:cyclic}'],
  ['@font-feature-values', '@font-feature-values X{@styleset{a:1}}'],
  ['at-rule nested inside a rule', '.a{@media screen{color:red}}'],
  [
    'at-rule nested inside an at-rule',
    '@media screen{@supports (display:grid){.a{color:red}}}',
  ],
  [
    'at-rule with both loose declarations and a nested rule',
    '.a{@media screen{color:red;.b{color:blue}}}',
  ],
  ['unknown at-rule', '@wat foo{.a{color:red}}'],

  // --- escapes -----------------------------------------------------------------------------
  ['escaped colon \\3A', '.a\\3A b{color:red}'],
  ['escaped at sign \\@', '.a\\@b{color:red}'],
  ['trailing backslash at EOF', '.a{color:red}\\'],
  ['unicode escape with a trailing space', '.\\1F600 x{color:red}'],
  ['unicode escape without a trailing space', '.\\1F600x{color:red}'],
  ['escaped brace in a selector', '.a\\{b{color:red}'],
  ['escaped quote in a selector', '.a\\"b{color:red}'],

  // --- malformed ---------------------------------------------------------------------------
  ['unterminated string', '.a{content:"abc}'],
  ['unterminated block', '.a{color:red'],
  ['unterminated paren', '.a{color:rgb(1,2,3}'],
  ['stray close paren', '.a{color:red)}'],
  ['stray close brace', '}.a{color:red}'],
  ['block with no selector', '{color:red}'],
  ['a lone semicolon', ';'],
  ['a lone empty block', '{}'],
  ['a lone close brace', '}'],
  ['a lone ampersand', '&'],
  ['a lone at sign', '@'],
];

describe('unseeded compile() is indistinguishable from stylis compile()', () => {
  it('has a corpus of at least 80 rows', () => {
    expect(CORPUS.length).toBeGreaterThanOrEqual(80);
  });

  it('has no duplicate labels', () => {
    const labels = CORPUS.map(([label]) => label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it.each(CORPUS)('%s', (_label, input) => {
    expectEquivalent(input);
  });
});

describe('unseeded compile() over a real 69KB stylesheet', () => {
  /**
   * `packages/erd-editor/src/styles/colorPicker.style.ts` holds a ~69KB vendored stylesheet in a
   * single template literal with no interpolations - by far the largest real CSS in the repo, and a
   * far better stress test than anything hand-written. It is read out of the sibling package rather
   * than imported, because `@dineug/r-html` does not (and must not) depend on `@dineug/erd-editor`.
   */
  const colorPickerCss = (() => {
    const source = readFileSync(
      resolveFromWorkspace(COLOR_PICKER_STYLE),
      'utf8'
    );
    const first = source.indexOf('`');
    const last = source.lastIndexOf('`');
    return source.slice(first + 1, last);
  })();

  it('reads a large stylesheet with no template interpolations', () => {
    expect(colorPickerCss.length).toBeGreaterThan(50_000);
    expect(colorPickerCss).not.toContain('${');
  });

  it('produces a byte-identical serialization', () => {
    expectEquivalent(colorPickerCss);
  });

  it('preserves the brace count of the source', () => {
    const count = (value: string, pattern: RegExp) =>
      (value.match(pattern) ?? []).length;

    const output = serialize(compile(colorPickerCss) as any, stringify);

    const open = count(colorPickerCss, /\{/g);
    expect(open).toBeGreaterThan(0);
    expect(count(colorPickerCss, /\}/g)).toBe(open);
    expect(count(output, /\{/g)).toBe(open);
    expect(count(output, /\}/g)).toBe(open);
  });
});
