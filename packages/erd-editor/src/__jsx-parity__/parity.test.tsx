import {
  cache,
  createRef,
  DOMTemplateLiterals,
  FC,
  html,
  innerHTML,
  onMounted,
  onUpdated,
  ref,
  render,
  repeat,
  svg,
} from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { flush } from '@/__test-utils__/index';

/**
 * The regression harness the JSX conversion commits lean on.
 *
 * The type layer in `src/jsx-runtime.d.ts` says what an attribute *means*; the
 * codegen in `@dineug/vite-plugin-r-html` decides what it *emits*. They are two
 * independent implementations of one mapping, and nothing makes them disagree
 * loudly — a wrong emit typechecks green and renders nothing. Every case here is
 * the same shape written twice, in JSX and in the tagged template it is supposed
 * to compile to, compared on the DOM that comes out.
 *
 * This file is `.tsx`, so the transform rewrites its JSX and leaves its tagged
 * templates alone. That is the point: both halves of each pair live side by side
 * in one module.
 */

const containers: HTMLDivElement[] = [];

const mount = (template: DOMTemplateLiterals | null) => {
  const container = document.createElement('div');
  document.body.append(container);
  containers.push(container);
  render(container, template);
  return container;
};

const draw = async (template: DOMTemplateLiterals) => {
  const container = mount(template);
  await flush();
  return container;
};

/**
 * Renders both spellings, asserts their markup is identical, and hands back the
 * JSX container so a case can go on to check something `innerHTML` cannot show.
 * Text assertions have to go through `textContent`: r-html separates every part
 * with comment markers, so `n:3` reaches the DOM as `n<!---->:<!---->3`.
 */
const both = async (jsx: DOMTemplateLiterals, tagged: DOMTemplateLiterals) => {
  const a = await draw(jsx);
  const b = await draw(tagged);
  expect(a.innerHTML).toBe(b.innerHTML);
  return a;
};

afterEach(() => {
  while (containers.length) {
    const container = containers.pop();
    if (!container) continue;
    render(container, null);
    container.remove();
  }
});

type ProbeProps = {
  label: string;
  count?: number;
  children?: DOMTemplateLiterals;
};

const Probe: FC<ProbeProps> = props => () =>
  html`<span class=${['probe']}>${props.label}:${props.count ?? 0}</span>`;

const Slotted: FC<{ children?: DOMTemplateLiterals }> = props => () =>
  html`<div class=${['slotted']}>${props.children}</div>`;

describe('markup parity', () => {
  it('keeps a static attribute static', async () => {
    await both(
      <div class="row" title="t" />,
      html`<div class="row" title="t"></div>`
    );
  });

  it('binds a dynamic class array', async () => {
    const value = ['table', null, 'is-active'];
    const el = await both(
      <div class={value} />,
      html`<div class=${value}></div>`
    );
    expect(el.innerHTML).toContain('is-active');
  });

  it('binds a style object with kebab keys', async () => {
    const value = { top: '3px', 'z-index': '2' };
    const el = await both(
      <div style={value} />,
      html`<div style=${value}></div>`
    );
    expect(el.innerHTML).toContain('z-index');
  });

  it('emits a valueless attribute', async () => {
    await both(<div hidden />, html`<div hidden></div>`);
  });

  it('renders text and interpolation together', async () => {
    const name = 'erd';
    const el = await both(
      <span>hello {name} !</span>,
      html`<span>hello ${name} !</span>`
    );
    expect(el.textContent).toBe('hello erd !');
  });

  it('nests elements', async () => {
    await both(
      <div class="outer">
        <span class="inner">x</span>
      </div>,
      html`<div class="outer"><span class="inner">x</span></div>`
    );
  });

  it('maps bool: onto ?', async () => {
    const on = true;
    const el = await both(
      <div bool:data-selected={on} />,
      html`<div ?data-selected=${on}></div>`
    );
    expect(el.innerHTML).toContain('data-selected');
  });

  it('carries data-* attributes', async () => {
    const id = 'abc';
    await both(
      <div data-id={id} data-type="table" />,
      html`<div data-id=${id} data-type="table"></div>`
    );
  });

  it('spreads an object of attributes', async () => {
    const rest = { title: 'spread', 'data-x': '1' };
    const el = await both(<div {...rest} />, html`<div ...${rest}></div>`);
    expect(el.innerHTML).toContain('spread');
  });

  it('passes props to a component', async () => {
    const el = await both(
      <Probe label="n" count={3} />,
      html`<${Probe} .label=${'n'} .count=${3} />`
    );
    expect(el.textContent).toBe('n:3');
  });

  it('passes JSX children as the children prop', async () => {
    const el = await both(
      <Slotted>
        <span>kid</span>
      </Slotted>,
      html`<${Slotted} .children=${html`<span>kid</span>`} />`
    );
    expect(el.querySelector('.slotted span')?.textContent).toBe('kid');
  });

  it('renders an array of templates', async () => {
    const rows = ['a', 'b', 'c'];
    await both(
      <div>
        {rows.map(row => (
          <span class="row">{row}</span>
        ))}
      </div>,
      html`<div>${rows.map(row => html`<span class="row">${row}</span>`)}</div>`
    );
  });

  it('renders a conditional branch', async () => {
    const ok = false;
    const el = await both(
      <div>{ok ? <span>yes</span> : <span>no</span>}</div>,
      html`<div>${ok ? html`<span>yes</span>` : html`<span>no</span>`}</div>`
    );
    expect(el.textContent).toBe('no');
  });

  it('renders an svg root', async () => {
    const d = 'M0 0 L1 1';
    await both(
      <svg viewBox="0 0 2 2">
        <path d={d} fill="red" />
      </svg>,
      svg`<svg viewBox="0 0 2 2"><path d=${d} fill="red"></path></svg>`
    );
  });

  it('renders a wrapper-less svg fragment in the svg namespace', async () => {
    const jsx = await draw(
      <>
        <line x1={0} y1={0} x2={1} y2={1} />
        <circle cx={1} cy={1} r={2} />
      </>
    );
    const tagged = await draw(
      svg`<line x1=${0} y1=${0} x2=${1} y2=${1}></line><circle cx=${1} cy=${1} r=${2}></circle>`
    );

    expect(jsx.innerHTML).toBe(tagged.innerHTML);
    // The namespace is the thing that silently renders nothing when inferred
    // wrong, and it does not show up in `innerHTML`.
    expect(jsx.querySelector('line')?.namespaceURI).toBe(
      'http://www.w3.org/2000/svg'
    );
  });

  it('composes a mixed static/dynamic attribute through a template literal', async () => {
    const width = 10;
    const height = 20;
    const el = await both(
      <svg viewBox={`0 0 ${width} ${height}`} />,
      svg`<svg viewBox="0 0 ${width} ${height}"></svg>`
    );
    expect(el.innerHTML).toContain('0 0 10 20');
  });

  it('renders the repeat directive', async () => {
    const rows = [
      { id: '1', v: 'a' },
      { id: '2', v: 'b' },
    ];
    await both(
      <div>
        {repeat(
          rows,
          row => row.id,
          row => (
            <span>{row.v}</span>
          )
        )}
      </div>,
      html`<div>
        ${repeat(
          rows,
          row => row.id,
          row => html`<span>${row.v}</span>`
        )}
      </div>`
    );
  });

  it('renders the cache directive', async () => {
    await both(
      <div>{cache(<span>cached</span>)}</div>,
      html`<div>${cache(html`<span>cached</span>`)}</div>`
    );
  });

  it('renders the innerHTML directive', async () => {
    const markup = '<b>raw</b>';
    const el = await both(
      <div>{innerHTML(markup)}</div>,
      html`<div>${innerHTML(markup)}</div>`
    );
    expect(el.innerHTML).toContain('<b>raw</b>');
  });

  it('escapes a backtick in text rather than ending the template', async () => {
    const el = await both(<span>a `b` c</span>, html`<span>a \`b\` c</span>`);
    expect(el.innerHTML).toContain('`b`');
  });

  it('escapes ${ in a string attribute rather than interpolating it', async () => {
    const el = await both(
      <div title="${danger}" />,
      html`<div title="\${danger}"></div>`
    );
    expect(el.innerHTML).toContain('${danger}');
  });
});

describe('binding parity', () => {
  it('routes on: to the same listener the @ sigil does', async () => {
    const jsxSpy = vi.fn();
    const taggedSpy = vi.fn();

    const jsx = await draw(<div class="hit" on:click={jsxSpy} />);
    const tagged = await draw(
      html`<div class="hit" @click=${taggedSpy}></div>`
    );

    jsx.querySelector('.hit')?.dispatchEvent(new Event('click'));
    tagged.querySelector('.hit')?.dispatchEvent(new Event('click'));

    expect(jsxSpy).toHaveBeenCalledTimes(1);
    expect(taggedSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps both handlers when one event is bound twice', async () => {
    const first = vi.fn();
    const second = vi.fn();

    const jsx = await draw(
      <div class="hit" on:click={first} on:click__2={second} />
    );
    jsx.querySelector('.hit')?.dispatchEvent(new Event('click'));

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('sets a DOM property through prop:', async () => {
    const jsx = await draw(<input class="a" prop:value="typed" />);
    const tagged = await draw(html`<input class="b" .value=${'typed'} />`);

    expect((jsx.querySelector('input') as HTMLInputElement).value).toBe(
      'typed'
    );
    expect((tagged.querySelector('input') as HTMLInputElement).value).toBe(
      'typed'
    );
  });

  it('resolves use:ref to the same node the bare marker does', async () => {
    const jsxRef = createRef<HTMLDivElement>();
    const taggedRef = createRef<HTMLDivElement>();

    const jsx = await draw(<div class="r" use:ref={ref(jsxRef)} />);
    const tagged = await draw(html`<div class="r" ${ref(taggedRef)}></div>`);

    expect(jsxRef.value).toBe(jsx.querySelector('.r'));
    expect(taggedRef.value).toBe(tagged.querySelector('.r'));
  });
});

describe('update parity', () => {
  const Counter: FC<{ step: number }> = props => () => (
    <div class="counter" data-step={String(props.step)}>
      <span class="value">{props.step}</span>
    </div>
  );

  /**
   * One call site, so both renders share a `TemplateStringsArray` — that
   * identity is what `templateCache` and `ContainerPart#equalStrings` key on,
   * and it is the whole reason the transform emits a real tagged template
   * rather than building nodes at runtime. Two separate literals would be two
   * templates and would legitimately rebuild.
   */
  const view = (step: number) => html`<${Counter} .step=${step} />`;

  it('reuses the DOM across a re-render instead of rebuilding it', async () => {
    const container = mount(view(1));
    await flush();

    const before = container.querySelector('.value');
    render(container, view(2));
    await flush();
    const after = container.querySelector('.value');

    expect(before).toBe(after);
    expect(after?.textContent).toBe('2');
  });

  it('does not re-mount a component whose props changed', async () => {
    const mountedSpy = vi.fn();
    const updatedSpy = vi.fn();

    const Watched: FC<{ n: number }> = props => {
      onMounted(mountedSpy);
      onUpdated(updatedSpy);
      return () => <span class="w">{props.n}</span>;
    };

    const watched = (n: number) => html`<${Watched} .n=${n} />`;

    const container = mount(watched(1));
    await flush();
    render(container, watched(2));
    await flush();

    expect(mountedSpy).toHaveBeenCalledTimes(1);
    expect(updatedSpy.mock.calls.length).toBeGreaterThan(0);
    expect(container.querySelector('.w')?.textContent).toBe('2');
  });
});
