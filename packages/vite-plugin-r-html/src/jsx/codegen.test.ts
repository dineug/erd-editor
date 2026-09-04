import { describe, expect, it } from 'vite-plus/test';

import { transformJsxToTagged } from './codegen';

const IMPORT_LINE = /^import \{[^}]*\} from '[^']*';/;

/** The emitted template, with the injected tag import stripped for legibility. */
const emit = (source: string) =>
  (transformJsxToTagged(source, 'test.tsx') ?? '').replace(IMPORT_LINE, '');

const expr = (source: string) => emit(`const a = ${source};`);

const PRAGMA = '/** @jsxHost konva */\n';
const KONVA_SOURCE = 'src/konva/host';

/** The same, for a konva file — the pragma line is stripped along with the import. */
const konvaEmit = (source: string) =>
  (
    transformJsxToTagged(
      `${PRAGMA}${source}`,
      'test.tsx',
      undefined,
      KONVA_SOURCE
    ) ?? ''
  )
    .replace(IMPORT_LINE, '')
    .replace(PRAGMA, '');

const konvaExpr = (source: string) => konvaEmit(`const a = ${source};`);

describe('intrinsic elements', () => {
  it('keeps a static attribute static, so it lands in staticAttrs', () => {
    expect(expr('<div class="row" />')).toBe(
      'const a = __rHtml`<div class="row" />`;'
    );
  });

  it('turns an expression attribute into a marker', () => {
    expect(expr('<div class={styles.root} />')).toBe(
      'const a = __rHtml`<div class=${styles.root} />`;'
    );
  });

  it('leaves class and style spelled the way r-html reads them', () => {
    expect(expr("<div class={['a', b]} style={{ 'z-index': 3 }} />")).toBe(
      "const a = __rHtml`<div class=${['a', b]} style=${{ 'z-index': 3 }} />`;"
    );
  });

  it('emits a valueless attribute as a bare name', () => {
    expect(expr('<div hidden />')).toBe('const a = __rHtml`<div hidden />`;');
  });

  it('keeps an explicit open/close pair even when empty', () => {
    expect(expr('<div></div>')).toBe('const a = __rHtml`<div></div>`;');
  });

  it('renders children between the tags', () => {
    expect(expr('<div><span>{label}</span></div>')).toBe(
      'const a = __rHtml`<div><span>${label}</span></div>`;'
    );
  });

  it('carries a dashed custom element name through unchanged', () => {
    expect(expr('<erd-editor readonly />')).toBe(
      'const a = __rHtml`<erd-editor readonly />`;'
    );
  });
});

describe('attribute namespaces', () => {
  it('maps bool: to ?', () => {
    expect(expr('<input bool:disabled={x} />')).toBe(
      'const a = __rHtml`<input ?disabled=${x} />`;'
    );
  });

  it('maps on: to @', () => {
    expect(expr('<div on:click={handle} />')).toBe(
      'const a = __rHtml`<div @click=${handle} />`;'
    );
  });

  it('maps prop: to .', () => {
    expect(expr('<input prop:value={v} />')).toBe(
      'const a = __rHtml`<input .value=${v} />`;'
    );
  });

  it('emits use: as a bare marker, which is how r-html spells a directive', () => {
    expect(expr('<div use:ref={ref(root)} />')).toBe(
      'const a = __rHtml`<div ${ref(root)} />`;'
    );
  });

  it('drops the __n suffix that lets one event be bound twice', () => {
    expect(expr('<div on:input={a} on:input__2={b} />')).toBe(
      'const a = __rHtml`<div @input=${a} @input=${b} />`;'
    );
  });

  it('rejects a namespace it does not know', () => {
    expect(() => expr('<div wat:x={y} />')).toThrow(
      /unknown attribute namespace/
    );
  });

  it('rejects use: without a value', () => {
    expect(() => expr('<div use:ref />')).toThrow(/needs an expression value/);
  });
});

describe('spread', () => {
  it('emits ...${} in attribute position', () => {
    expect(expr('<div {...restAttrs({ title })} />')).toBe(
      'const a = __rHtml`<div ...${restAttrs({ title })} />`;'
    );
  });

  it('rejects a spread child', () => {
    expect(() => expr('<div>{...items}</div>')).toThrow(/not supported/);
  });
});

describe('components', () => {
  it('references the component through a marker', () => {
    expect(expr('<Icon name="key" />')).toBe(
      'const a = __rHtml`<${Icon} .name="key" />`;'
    );
  });

  it('dots every attribute, so an `on`-prefixed prop is not read as an event', () => {
    expect(expr('<Toast once={x} onClick={h} />')).toBe(
      'const a = __rHtml`<${Toast} .once=${x} .onClick=${h} />`;'
    );
  });

  it('still routes on: to the event bus rather than to props', () => {
    expect(expr('<Icon name="x" on:click={h} />')).toBe(
      'const a = __rHtml`<${Icon} .name="x" @click=${h} />`;'
    );
  });

  it('resolves a member-expression tag', () => {
    expect(expr('<ContextMenu.Item onClick={h} />')).toBe(
      'const a = __rHtml`<${ContextMenu.Item} .onClick=${h} />`;'
    );
  });

  it('passes JSX children as the children prop, since r-html has no slot', () => {
    expect(expr('<Menu><span>hi</span></Menu>')).toBe(
      'const a = __rHtml`<${Menu} .children=${__rHtml`<span>hi</span>`} />`;'
    );
  });

  it('refuses children given twice', () => {
    expect(() => expr('<Menu children={x}><span /></Menu>')).toThrow(
      /both a `children` attribute and JSX children/
    );
  });

  it('nests a component inside an attribute value', () => {
    expect(expr('<Menu icon={<Icon name="key" />} />')).toBe(
      'const a = __rHtml`<${Menu} .icon=${__rHtml`<${Icon} .name="key" />`} />`;'
    );
  });
});

describe('fragments and expressions', () => {
  it('emits a fragment root with no wrapper', () => {
    expect(expr('<><div /><span /></>')).toBe(
      'const a = __rHtml`<div /><span />`;'
    );
  });

  it('converts JSX nested inside a conditional child', () => {
    expect(expr('<div>{ok ? <a1 /> : <b1 />}</div>')).toBe(
      'const a = __rHtml`<div>${ok ? __rHtml`<a1 />` : __rHtml`<b1 />`}</div>`;'
    );
  });

  it('converts JSX inside a callback', () => {
    expect(expr('<ul>{rows.map(r => <li>{r}</li>)}</ul>')).toBe(
      'const a = __rHtml`<ul>${rows.map(r => __rHtml`<li>${r}</li>`)}</ul>`;'
    );
  });

  it('drops a comment-only expression container', () => {
    expect(expr('<div>{/* nothing */}</div>')).toBe(
      'const a = __rHtml`<div></div>`;'
    );
  });
});

describe('text', () => {
  it('applies JSX whitespace rules rather than copying the source', () => {
    // Wrapped lines join with one space and lose their indentation — the
    // source indentation must not reach the DOM as text.
    expect(emit('const a = <p>\n  one\n  two\n</p>;')).toBe(
      'const a = __rHtml`<p>one two</p>`\n\n\n;'
    );
  });

  it('keeps significant single spaces around an interpolation', () => {
    expect(expr('<p>a {b} c</p>')).toBe('const a = __rHtml`<p>a ${b} c</p>`;');
  });
});

describe('escaping', () => {
  it('escapes a backtick in text', () => {
    expect(expr('<p>a `b` c</p>')).toBe(
      'const a = __rHtml`<p>a \\`b\\` c</p>`;'
    );
  });

  it('escapes ${ in a string attribute, the one place JSX lets it through', () => {
    // JSX text cannot contain ${ — { always opens an expression container —
    // but a string attribute value is raw, so this is the real injection path.
    expect(expr('<div title="${danger}" />')).toBe(
      'const a = __rHtml`<div title="\\${danger}" />`;'
    );
  });

  it('leaves a trailing $ before an interpolation alone', () => {
    // $ + ${price} is two tokens to the template scanner, not $${.
    expect(expr('<p>cost {price}</p>')).toBe(
      'const a = __rHtml`<p>cost ${price}</p>`;'
    );
  });

  it('escapes a backslash in text', () => {
    expect(expr('<p>a\\b</p>')).toBe('const a = __rHtml`<p>a\\\\b</p>`;');
  });

  it('escapes a double quote in a string attribute value', () => {
    expect(expr('<div title=\'say "hi"\' />')).toBe(
      'const a = __rHtml`<div title="say &quot;hi&quot;" />`;'
    );
  });
});

describe('svg', () => {
  it('tags an svg root with the svg literal', () => {
    expect(expr('<svg viewBox="0 0 1 1"><path d={d} /></svg>')).toBe(
      'const a = __rSvg`<svg viewBox="0 0 1 1"><path d=${d} /></svg>`;'
    );
  });

  it('tags a wrapper-less svg fragment from its first child', () => {
    expect(expr('<><line x1={a1} /><circle r={r1} /></>')).toBe(
      'const a = __rSvg`<line x1=${a1} /><circle r=${r1} />`;'
    );
  });

  it('tags a bare svg-only root', () => {
    expect(expr('<path d={d} />')).toBe('const a = __rSvg`<path d=${d} />`;');
  });

  it('resolves a tag HTML and SVG share to HTML, as IntrinsicElements does', () => {
    expect(expr('<title>x</title>')).toBe(
      'const a = __rHtml`<title>x</title>`;'
    );
    expect(expr('<style>{sheet}</style>')).toBe(
      'const a = __rHtml`<style>${sheet}</style>`;'
    );
  });

  it('still puts a shared tag in the svg namespace under an svg root', () => {
    expect(expr('<svg><title>x</title></svg>')).toBe(
      'const a = __rSvg`<svg><title>x</title></svg>`;'
    );
  });
});

describe('the file around the JSX', () => {
  it('leaves a file with no JSX alone', () => {
    expect(transformJsxToTagged('export const a = 1;\n', 'test.tsx')).toBe(
      null
    );
  });

  it('imports only the tag it used', () => {
    expect(transformJsxToTagged('const a = <div />;', 'test.tsx')).toBe(
      "import { html as __rHtml } from '@dineug/r-html';const a = __rHtml`<div />`;"
    );
    expect(transformJsxToTagged('const a = <path />;', 'test.tsx')).toBe(
      "import { svg as __rSvg } from '@dineug/r-html';const a = __rSvg`<path />`;"
    );
  });

  it('honours a custom import source', () => {
    expect(transformJsxToTagged('const a = <div />;', 'test.tsx', 'x')).toBe(
      "import { html as __rHtml } from 'x';const a = __rHtml`<div />`;"
    );
  });

  it('holds the line count steady, so every later line keeps its number', () => {
    const source = [
      'const a = (',
      '  <div>',
      '    <span />',
      '  </div>',
      ');',
      'const b = 2;',
    ].join('\n');
    const out = transformJsxToTagged(source, 'test.tsx') ?? '';
    expect(out.split('\n')).toHaveLength(source.split('\n').length);
    expect(out.split('\n')[5]).toBe('const b = 2;');
  });

  it('reports the file and position of a rejected construct', () => {
    expect(() =>
      transformJsxToTagged('\nconst a = <div wat:x={y} />;', 'Foo.tsx')
    ).toThrow(/\[r-html-jsx\] Foo\.tsx:2:16/);
  });
});

describe('the jsx host pragma', () => {
  it('compiles every root in the file with the konva tag', () => {
    expect(konvaExpr('<k-group x={x}><k-rect /></k-group>')).toBe(
      'const a = __rKonva`<k-group x=${x}><k-rect /></k-group>`;'
    );
  });

  it('follows the file into a template nested in an expression', () => {
    expect(
      konvaExpr('<k-layer>{rows.map(r => <k-rect key={r} />)}</k-layer>')
    ).toBe(
      'const a = __rKonva`<k-layer>${rows.map(r => __rKonva`<k-rect key=${r} />`)}</k-layer>`;'
    );
  });

  it('wraps component children with the konva tag rather than html', () => {
    expect(konvaExpr('<Table><k-rect /></Table>')).toBe(
      'const a = __rKonva`<${Table} .children=${__rKonva`<k-rect />`} />`;'
    );
  });

  it('imports the konva tag from konvaImportSource, and nothing from r-html', () => {
    expect(
      transformJsxToTagged(
        `${PRAGMA}const a = <k-rect />;`,
        'test.tsx',
        undefined,
        KONVA_SOURCE
      )
    ).toBe(
      "import { konva as __rKonva } from 'src/konva/host';/** @jsxHost konva */\nconst a = __rKonva`<k-rect />`;"
    );
  });

  it('refuses the pragma when no konva import source is configured', () => {
    expect(() =>
      transformJsxToTagged(`${PRAGMA}const a = <k-rect />;`, 'test.tsx')
    ).toThrow(/needs the konvaImportSource option/);
  });

  it('reads the pragma from a block comment only', () => {
    expect(() =>
      transformJsxToTagged(
        '// @jsxHost konva\nconst a = <k-rect />;',
        'test.tsx',
        undefined,
        KONVA_SOURCE
      )
    ).toThrow(/block comment above the first statement/);
  });

  it('reads the pragma from above the first statement only', () => {
    expect(() =>
      transformJsxToTagged(
        `const b = 1;\n${PRAGMA}const a = <k-rect />;`,
        'test.tsx',
        undefined,
        KONVA_SOURCE
      )
    ).toThrow(/block comment above the first statement/);
  });

  it('rejects a host it does not know', () => {
    expect(() =>
      transformJsxToTagged(
        '/** @jsxHost svg */\nconst a = <path />;',
        'test.tsx'
      )
    ).toThrow(/unknown jsx host `svg`/);
  });

  it('leaves the dom host resolving html and svg the way it always did', () => {
    expect(
      transformJsxToTagged(
        '/** @jsxHost dom */\nconst a = <path />;',
        'test.tsx'
      )
    ).toBe(
      "import { svg as __rSvg } from '@dineug/r-html';/** @jsxHost dom */\nconst a = __rSvg`<path />`;"
    );
  });
});

describe('one file, one host', () => {
  it('rejects an HTML tag in a konva file', () => {
    expect(() => konvaExpr('<k-group><div /></k-group>')).toThrow(
      /<div> is a DOM tag in a @jsxHost konva file/
    );
  });

  it('rejects an SVG tag in a konva file', () => {
    expect(() => konvaExpr('<path d={d} />')).toThrow(
      /<path> is a DOM tag in a @jsxHost konva file/
    );
  });

  it('rejects a konva tag in a file with no pragma', () => {
    expect(() => expr('<k-rect />')).toThrow(
      /<k-rect> needs the @jsxHost konva pragma/
    );
  });

  it('takes a component tag in either host, since it names no host', () => {
    expect(konvaExpr('<Table id={id} />')).toBe(
      'const a = __rKonva`<${Table} .id=${id} />`;'
    );
    expect(expr('<Table id={id} />')).toBe(
      'const a = __rHtml`<${Table} .id=${id} />`;'
    );
  });
});

describe('konva children', () => {
  it('rejects a text child, which a konva tree has nowhere to put', () => {
    expect(() => konvaExpr('<k-group>label</k-group>')).toThrow(
      /no text nodes/
    );
  });

  it('rejects a string literal child', () => {
    expect(() => konvaExpr("<k-group>{'label'}</k-group>")).toThrow(
      /no text nodes/
    );
  });

  it('rejects a number literal child', () => {
    expect(() => konvaExpr('<k-group>{1}</k-group>')).toThrow(/no text nodes/);
  });

  it('keeps whitespace-only text, which is dropped before it can offend', () => {
    expect(konvaExpr('<k-group>\n  <k-rect />\n</k-group>')).toBe(
      'const a = __rKonva`<k-group><k-rect /></k-group>`\n\n;'
    );
  });

  it('keeps an expression child, which stands for nodes at runtime', () => {
    expect(konvaExpr('<k-group>{children}</k-group>')).toBe(
      'const a = __rKonva`<k-group>${children}</k-group>`;'
    );
  });
});

describe('konva attributes', () => {
  it('rejects a spread, which would reach the node through Reflect.set', () => {
    expect(() => konvaExpr('<k-rect {...attrs} />')).toThrow(
      /a spread on a k-\* tag is not supported/
    );
  });

  it('rejects class, which commits through an HTMLElement check', () => {
    expect(() => konvaExpr('<k-rect class={c} />')).toThrow(
      /`class` is not a konva attribute/
    );
  });

  it('rejects style, for the same reason', () => {
    expect(() => konvaExpr('<k-rect style={s} />')).toThrow(
      /`style` is not a konva attribute/
    );
  });

  it('rejects zIndex, because z-order belongs to the host', () => {
    expect(() => konvaExpr('<k-rect zIndex={2} />')).toThrow(
      /`zIndex` is not a konva attribute/
    );
  });

  it('keeps a spread on a component tag, which lands on props', () => {
    expect(konvaExpr('<Table {...rest} />')).toBe(
      'const a = __rKonva`<${Table} ...${rest} />`;'
    );
  });
});

/** Breadth of the DOM half in one file — the witness for the byte-invariance below. */
const DOM_FIXTURE = [
  "import { Menu } from './Menu';",
  '',
  'export function View({ rows, title, empty }) {',
  '  return (',
  '    <div class={styles.root} title="view" bool:hidden={empty} on:click={onClick}>',
  '      <span>cost {title} more</span>',
  '      <Menu icon={<Icon name="key" />} {...rest}>',
  '        <li>one</li>',
  '      </Menu>',
  '      <svg viewBox="0 0 1 1">',
  '        <path d={d} />',
  '      </svg>',
  '      {rows.map(row => (',
  '        <p use:ref={ref(row)} prop:value={row.value}>{row.label}</p>',
  '      ))}',
  '    </div>',
  '  );',
  '}',
  '',
  'export const badge = (',
  '  <svg viewBox="0 0 2 2">',
  '    <circle r={r} />',
  '  </svg>',
  ');',
  '',
].join('\n');

describe('a file with no pragma', () => {
  it('compiles byte for byte the way it did before the host existed', () => {
    expect(transformJsxToTagged(DOM_FIXTURE, 'View.tsx'))
      .toMatchInlineSnapshot(`
      "import { html as __rHtml, svg as __rSvg } from '@dineug/r-html';import { Menu } from './Menu';

      export function View({ rows, title, empty }) {
        return (
          __rHtml\`<div class=\${styles.root} title="view" ?hidden=\${empty} @click=\${onClick}><span>cost \${title} more</span><\${Menu} .icon=\${__rHtml\`<\${Icon} .name="key" />\`} ...\${rest} .children=\${__rHtml\`<li>one</li>\`} /><svg viewBox="0 0 1 1"><path d=\${d} /></svg>\${rows.map(row => (
              __rHtml\`<p \${ref(row)} .value=\${row.value}>\${row.label}</p>\`
            ))}</div>\`









        );
      }

      export const badge = (
        __rSvg\`<svg viewBox="0 0 2 2"><circle r=\${r} /></svg>\`


      );
      "
    `);
  });
});
