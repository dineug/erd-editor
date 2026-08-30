import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { TEMPLATE_LITERALS } from '@/constants';
import { CSS_SOURCE, TemplateLiteralsType } from '@/template';
import { css } from '@/template/css';
import {
  buildSource,
  classifySlots,
  Slot,
  slotText,
  terminate,
} from '@/template/cssSource';

/** strings.raw of a tagged template, without needing a call site for every shape. */
const raw = (...parts: string[]): readonly string[] => parts;

const kindsOf = (...parts: string[]) =>
  classifySlots(raw(...parts)).map(({ kind }) => kind);

/** Passes isCSSTemplateLiterals without carrying a resolved source. */
const fakeLiteral = (): any => {
  const strings: any = ['a'];
  strings.raw = ['a'];
  return {
    strings,
    values: [],
    [TEMPLATE_LITERALS]: TemplateLiteralsType.css,
  };
};

const statement: Slot = { kind: 'statement', provable: true };
const unprovable: Slot = { kind: 'statement', provable: false };
const inline: Slot = { kind: 'inline', provable: false };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('classifySlots', () => {
  it('returns one slot per gap', () => {
    expect(classifySlots(raw('only'))).toEqual([]);
    expect(classifySlots(raw('a', 'b'))).toHaveLength(1);
    expect(classifySlots(raw('a', 'b', 'c'))).toHaveLength(2);
  });

  it('reads a mixin site as a statement', () => {
    // typography.styles.ts:20 — ${fontSize2};
    expect(kindsOf('\n  ', ';\n')).toEqual(['statement']);
    // Toast.styles.ts:33 — ${typography.paragraph}; after another declaration
    expect(kindsOf('\n  color: red;\n  ', ';\n')).toEqual(['statement']);
    // Icon.stories.ts — the one mixin site that is not followed by a ;
    expect(kindsOf('\n  ', '\n                  ')).toEqual(['statement']);
  });

  it('reads a selector site as inline', () => {
    // CodeBlock.styles.ts:60 — ${clipboard} {
    expect(kindsOf('\n  ', ' {\n    opacity: 1;\n  }\n')).toEqual(['inline']);
    // css.test.ts — .wrap ${child} {
    expect(kindsOf('\n  .wrap ', ' {\n    color: pink;\n  }\n')).toEqual([
      'inline',
    ]);
  });

  it('reads a declaration value site as inline', () => {
    // Settings.styles.ts:55 — width: ${size}px
    expect(kindsOf('\n  width: ', 'px;\n')).toEqual(['inline']);
    // typography.styles.ts:4 — var(--font-size-${size})
    expect(kindsOf('\n  font-size: var(--font-size-', ');\n')).toEqual([
      'inline',
    ]);
  });

  it('misreads the middle slots of a shorthand as unprovable statements', () => {
    // Column.styles.ts etc — padding: ${A}px ${B}px ${C}px 0;. Eight sites in erd-editor
    // land here. They are harmless because every one of them holds a number, and slotText()
    // ignores kind for primitives — not because the rule proved anything.
    const slots = classifySlots(raw('\n  padding: ', 'px ', 'px ', 'px 0;\n'));

    expect(slots).toEqual([
      { kind: 'inline', provable: false },
      { kind: 'statement', provable: false },
      { kind: 'statement', provable: false },
    ]);
  });

  it('marks a statement provable only when nothing but whitespace precedes it', () => {
    expect(classifySlots(raw('\n  ', ';\n'))).toEqual([
      { kind: 'statement', provable: true },
    ]);
    expect(classifySlots(raw('.a{color:red;', ';\n'))).toEqual([
      { kind: 'statement', provable: true },
    ]);
    expect(classifySlots(raw('px ', ';\n'))).toEqual([
      { kind: 'statement', provable: false },
    ]);
  });

  it('reads adjacent slots off the empty string between them', () => {
    // color: ${a}${b}; — the second slot sees an empty head and reads as a statement. Harmless
    // for the primitives that actually occur, and documented here so the shape is not a surprise.
    expect(classifySlots(raw('\n  color: ', '', ';\n'))).toEqual([
      { kind: 'inline', provable: false },
      { kind: 'statement', provable: true },
    ]);
  });

  it('falls back to inline whenever either side is ambiguous', () => {
    // A colon in the head is enough, wherever it sits in the compound.
    expect(kindsOf('\n  background: url(', ');\n')).toEqual(['inline']);
    // So is a brace in the tail, before any ;, } or newline.
    expect(kindsOf('\n  ', '.a { color: red; }\n')).toEqual(['inline']);
    // A brace after the tail delimiter does not count.
    expect(kindsOf('\n  ', ';\n  .a { color: red; }\n')).toEqual(['statement']);
  });
});

describe('terminate', () => {
  it('appends a semicolon to an unterminated source', () => {
    // The probe that makes this mandatory: without it the two declarations weld into one.
    expect(terminate('color:red\nfont-size:1px')).toBe(
      'color:red\nfont-size:1px;'
    );
  });

  it('leaves a source that already ends in a delimiter alone', () => {
    expect(terminate('color:red;')).toBe('color:red;');
    expect(terminate('\n  color: red;\n  ')).toBe('\n  color: red;\n  ');
    expect(terminate('.a{color:red}')).toBe('.a{color:red}');
    expect(terminate('\n  .a { color: red; }\n')).toBe(
      '\n  .a { color: red; }\n'
    );
  });

  it('leaves an empty source empty', () => {
    expect(terminate('')).toBe('');
    expect(terminate('  \n ')).toBe('  \n ');
  });
});

describe('slotText', () => {
  it('splices the resolved source of a css literal into a statement slot', () => {
    const child = css`
      color: red;
    `;

    // oxfmt formats the contents of a css literal, so an unterminated declaration cannot be
    // written here; terminate() covers that path against raw strings instead.
    expect(child[CSS_SOURCE]).toBe('\n      color: red;\n    ');
    expect(slotText(child, 'statement')).toBe('\n      color: red;\n    ');
  });

  it('renders a css literal in an inline slot as its class selector', () => {
    const child = css`
      color: blue;
    `;

    expect(slotText(child, 'inline')).toBe(`.${String(child)}`);
  });

  it('tolerates a literal that carries no resolved source', () => {
    expect(slotText(fakeLiteral(), 'statement')).toBe('');
  });

  it('ignores the kind for primitives', () => {
    for (const kind of ['statement', 'inline'] as const) {
      expect(slotText(10, kind)).toBe('10');
      expect(slotText('red', kind)).toBe('red');
      expect(slotText(0, kind)).toBe('0');
      expect(slotText(false, kind)).toBe('false');
      expect(slotText('', kind)).toBe('');
    }
  });

  it('drops null, undefined and anything that is not a primitive', () => {
    expect(slotText(null, 'inline')).toBe('');
    expect(slotText(undefined, 'inline')).toBe('');
    expect(slotText({}, 'inline')).toBe('');
    expect(slotText([1, 2], 'inline')).toBe('');
    expect(slotText(() => {}, 'inline')).toBe('');
  });
});

describe('buildSource', () => {
  it('weaves the slot texts between the raw strings', () => {
    expect(buildSource(raw('height: ', 'px;'), [inline], [10])).toBe(
      'height: 10px;'
    );
  });

  it('keeps a trailing raw string that has no slot behind it', () => {
    expect(buildSource(raw('a', 'b', 'c'), [inline, inline], [1, 2])).toBe(
      'a1b2c'
    );
  });

  it('substitutes nothing for a value the slot cannot render', () => {
    expect(buildSource(raw('color: ', ';'), [inline], [null])).toBe('color: ;');
  });

  it('reports a css literal spliced after unterminated text', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const child = css`
      color: red;
    `;

    buildSource(raw('padding: 1px ', ';'), [unprovable], [child]);

    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toContain('spliced in as a statement');
  });

  it('stays quiet for a css literal in a provable statement slot', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const child = css`
      color: red;
    `;

    buildSource(raw('\n  ', ';'), [statement], [child]);
    buildSource(raw('.wrap ', ' {}'), [inline], [child]);

    expect(error).not.toHaveBeenCalled();
  });

  it('stays quiet for a primitive in an unprovable statement slot', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    buildSource(raw('padding: 1px ', 'px;'), [unprovable], [8]);

    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns when a substituted value carries a brace', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    buildSource(raw('color: ', ';'), [inline], ['red} .evil{color:blue']);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('brace');
  });

  it('warns when a substituted value has an unbalanced quote', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    buildSource(raw('content: ', ';'), [inline], ["'a"]);
    buildSource(raw('content: ', ';'), [inline], ['"a']);

    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0][0]).toContain('unbalanced quote');
  });

  it('stays quiet for balanced quotes', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    buildSource(raw('content: ', ';'), [inline], ["'a'"]);
    buildSource(raw('font-family: ', ';'), [inline], ['"Segoe UI", Roboto']);

    expect(warn).not.toHaveBeenCalled();
  });
});
