import { beforeAll, describe, expect, it } from 'vitest';

import { css } from '@/template/css';
import { addCSSHost } from '@/template/vCSSStyleSheet';

const host = document.createElement('div').attachShadow({ mode: 'open' });

const rulesOf = (identifier: string): string[] =>
  host.adoptedStyleSheets
    .flatMap(sheet => Array.from(sheet.cssRules).map(rule => rule.cssText))
    .filter(text => text.includes(identifier));

beforeAll(() => {
  addCSSHost(host);
});

const value = css`
  height: ${10}px;
  color: ${'red'};
`;

const child = css`
  font-size: ${1}px;
`;

const parent = css`
  ${child};
  font-weight: bold;
`;

const grandparent = css`
  ${parent};
  color: navy;
`;

const selectorSlot = css`
  .wrap ${child} {
    color: pink;
  }
`;

const ampersand = css`
  &:hover {
    color: red;
  }
  &.active {
    color: blue;
  }
  & > span {
    color: green;
  }
  & &:focus {
    color: teal;
  }
  .a & {
    color: navy;
  }
`;

const selectorList = css`
  .relationship:hover,
  .relationship[data-hover],
  .relationship.identification[data-hover] {
    color: red;
  }
`;

const media = css`
  color: red;
  @media (min-width: 100px) {
    color: blue;
    .nested {
      color: green;
    }
  }
`;

const keyframes = css`
  animation: fixtureMove 0.3s;
  @keyframes fixtureMove {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;

const shadowBoundary = css`
  :host {
    color: red;
  }
`;

const mixed = css`
  color: red;
  .foo {
    color: blue;
  }
  &:hover .bar {
    color: green;
  }
`;

const rootLast = css`
  .foo {
    color: blue;
  }
  color: red;
`;

const nestedMixin = css`
  &.active {
    ${child};
    color: navy;
  }
`;

// `Switch.styles.ts` shape — a quoted attribute selector and comma lists in declaration values.
const track = css`
  transition: background-position, background-color;
  transition-timing-function: linear, ease-in-out;

  &[data-checked='true']::before {
    transition-duration: 0.16s, 0.14s;
    background-color: var(--accent-color-9);
  }
`;

// `ErdEditor.styles.ts` shape — a mixin, own declarations, and a nested rule that only has children.
const container = css`
  display: flex;
  overflow: hidden;
`;

// `outline: none` is deliberately not used here: happy-dom expands that shorthand into three
// longhands, which would put its CSSOM quirks in the expected value instead of the emitted CSS.
const composite = css`
  ${container};
  background-color: var(--canvas-boundary-background);

  &.none-focus {
    div[data-focus-border] {
      border-color: var(--placeholder) !important;
    }
  }
`;

// `CodeBlock.styles.ts` shape — a sibling literal used as a selector inside a nested rule.
const clipboard = css`
  opacity: 0;
`;

const hoverOnly = css`
  &:hover {
    ${clipboard} {
      opacity: 1;
    }
  }
`;

describe('emitted css fixtures', () => {
  it('substitutes a value slot into the declaration', () => {
    expect(rulesOf(String(value))).toEqual([
      `.${String(value)} { height: 10px; color: red; }`,
    ]);
  });

  it('splices a statement slot two levels deep into one rule', () => {
    expect(rulesOf(String(parent))).toEqual([
      `.${String(parent)} { font-size: 1px; font-weight: bold; }`,
    ]);
    expect(rulesOf(String(grandparent))).toEqual([
      `.${String(grandparent)} { font-size: 1px; font-weight: bold; color: navy; }`,
    ]);
  });

  it('renders a selector slot as the child class', () => {
    expect(rulesOf(String(selectorSlot))).toEqual([
      `.${String(selectorSlot)} .wrap .${String(child)} { color: pink; }`,
    ]);
  });

  it('resolves every & form against the scope', () => {
    expect(rulesOf(String(ampersand))).toEqual([
      `.${String(ampersand)}:hover { color: red; }`,
      `.${String(ampersand)}.active { color: blue; }`,
      `.${String(ampersand)}>span { color: green; }`,
      `.${String(ampersand)} .${String(ampersand)}:focus { color: teal; }`,
      `.a .${String(ampersand)} { color: navy; }`,
    ]);
  });

  it('scopes every segment of a selector list', () => {
    expect(rulesOf(String(selectorList))).toEqual([
      `.${String(selectorList)} .relationship:hover,.${String(selectorList)} .relationship[data-hover],.${String(selectorList)} .relationship.identification[data-hover] { color: red; }`,
    ]);
  });

  it('keeps nested rules inside their conditional at-rule', () => {
    expect(rulesOf(String(media))).toEqual([
      `.${String(media)} { color: red; }`,
      `@media (min-width: 100px) {\n  .${String(media)} { color: blue; }\n  .${String(media)} .nested { color: green; }\n}`,
    ]);
  });

  it('leaves @keyframes steps unscoped and hoisted', () => {
    expect(rulesOf(String(keyframes))).toEqual([
      `.${String(keyframes)} { animation: fixtureMove 0.3s; }`,
    ]);
    // happy-dom renormalizes `from`/`to` into percentages; the steps keep no scope either way.
    expect(
      host.adoptedStyleSheets.flatMap(sheet =>
        Array.from(sheet.cssRules)
          .map(rule => rule.cssText)
          .filter(text => text.startsWith('@keyframes'))
      )
    ).toEqual([
      '@keyframes fixtureMove { \n  0% { opacity: 0; }\n  100% { opacity: 1; }\n}',
    ]);
  });

  it('prefixes :host with the scope instead of rewriting it', () => {
    expect(rulesOf(String(shadowBoundary))).toEqual([
      `.${String(shadowBoundary)} :host { color: red; }`,
    ]);
  });

  it('emits root declarations before the nested rules of the same template', () => {
    expect(rulesOf(String(mixed))).toEqual([
      `.${String(mixed)} { color: red; }`,
      `.${String(mixed)} .foo { color: blue; }`,
      `.${String(mixed)}:hover .bar { color: green; }`,
    ]);
  });

  it('hoists root declarations in front of the nested rules they were written after', () => {
    expect(rulesOf(String(rootLast))).toEqual([
      `.${String(rootLast)} { color: red; }`,
      `.${String(rootLast)} .foo { color: blue; }`,
    ]);
  });

  it('splices a statement slot that sits inside a nested rule', () => {
    expect(rulesOf(String(nestedMixin))).toEqual([
      `.${String(nestedMixin)}.active { font-size: 1px; color: navy; }`,
    ]);
  });

  it('keeps a quoted attribute selector and drops the space after a value comma', () => {
    expect(rulesOf(String(track))).toEqual([
      `.${String(track)} { transition: background-position,background-color; transition-timing-function: linear,ease-in-out; }`,
      `.${String(track)}[data-checked='true']::before { transition-duration: 0.16s,0.14s; background-color: var(--accent-color-9); }`,
    ]);
  });

  it('merges a mixin with its own declarations and keeps only the children of an empty nested rule', () => {
    expect(rulesOf(String(composite))).toEqual([
      `.${String(composite)} { display: flex; overflow: hidden; background-color: var(--canvas-boundary-background); }`,
      `.${String(composite)}.none-focus div[data-focus-border] { border-color: var(--placeholder) !important; }`,
    ]);
  });

  it('renders a sibling literal as a selector inside a nested rule, with no empty parent', () => {
    expect(rulesOf(String(hoverOnly))).toEqual([
      `.${String(hoverOnly)}:hover .${String(clipboard)} { opacity: 1; }`,
    ]);
  });

  it('puts one sheet per template on the host', () => {
    expect(host.adoptedStyleSheets).toHaveLength(18);
  });
});
