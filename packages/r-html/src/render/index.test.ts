import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { render } from '@/render';
import { css } from '@/template/css';
import { html } from '@/template/html';

const containers: Array<Element> = [];

const createContainer = () => {
  const container = document.createElement('div');
  document.body.append(container);
  containers.push(container);
  return container;
};

const divTemplate = (text: string, id: string) =>
  html`<div id=${id}>${text}</div>`;

const spanTemplate = (text: string) => html`<span>${text}</span>`;

afterEach(() => {
  while (containers.length) {
    const container = containers.pop();
    if (!container) continue;
    render(container, null);
    container.remove();
  }
});

describe('render', () => {
  it('renders a template into the container', () => {
    const container = createContainer();

    render(container, divTemplate('hello', 'a'));

    const div = container.querySelector('div');
    expect(div).not.toBeNull();
    expect(div?.getAttribute('id')).toBe('a');
    expect(container.textContent).toBe('hello');
  });

  it('applies a class binding declared as an array', () => {
    const container = createContainer();
    const withClass = (classes: string[]) =>
      html`<div class=${classes}>x</div>`;

    render(container, withClass(['a', 'b']));

    expect(container.querySelector('div')?.className).toBe('a b');

    render(container, withClass(['a', 'c']));

    expect(container.querySelector('div')?.className).toBe('a c');
  });

  it('does nothing when the value is not a template literal', () => {
    const container = createContainer();

    render(container, null);
    render(container, undefined);
    render(container, 'text' as any);
    render(container, {} as any);

    expect(container.childNodes.length).toBe(0);
  });

  it('recommits in place when the same template strings are reused', () => {
    const container = createContainer();

    render(container, divTemplate('one', 'a'));
    const first = container.querySelector('div');

    render(container, divTemplate('two', 'b'));
    const second = container.querySelector('div');

    expect(second).toBe(first);
    expect(second?.getAttribute('id')).toBe('b');
    expect(container.textContent).toBe('two');
  });

  it('keeps the DOM untouched when a recommit passes identical values', () => {
    const container = createContainer();

    render(container, divTemplate('same', 'a'));
    const before = Array.from(container.childNodes);

    render(container, divTemplate('same', 'a'));

    expect(Array.from(container.childNodes)).toEqual(before);
    expect(container.textContent).toBe('same');
  });

  it('replaces the whole tree when the template strings change', () => {
    const container = createContainer();

    render(container, divTemplate('one', 'a'));
    render(container, spanTemplate('two'));

    expect(container.querySelector('div')).toBeNull();
    expect(container.querySelector('span')?.textContent).toBe('two');
    expect(container.textContent).toBe('two');
  });

  it('destroys the rendered tree when re-rendered with null', () => {
    const container = createContainer();

    render(container, divTemplate('bye', 'a'));
    expect(container.childNodes.length).toBeGreaterThan(0);

    render(container, null);

    expect(container.childNodes.length).toBe(0);
    expect(container.textContent).toBe('');
  });

  it('is idempotent when destroyed twice', () => {
    const container = createContainer();

    render(container, divTemplate('bye', 'a'));
    render(container, null);
    expect(() => render(container, null)).not.toThrow();

    expect(container.childNodes.length).toBe(0);
  });

  it('renders again after a destroy', () => {
    const container = createContainer();

    render(container, divTemplate('one', 'a'));
    render(container, null);
    render(container, divTemplate('two', 'b'));

    expect(container.querySelector('div')?.getAttribute('id')).toBe('b');
    expect(container.textContent).toBe('two');
  });

  it('keeps a separate cache entry per container', () => {
    const a = createContainer();
    const b = createContainer();

    render(a, divTemplate('a', 'ca'));
    render(b, divTemplate('b', 'cb'));

    expect(a.textContent).toBe('a');
    expect(b.textContent).toBe('b');

    render(a, null);

    expect(a.childNodes.length).toBe(0);
    expect(b.textContent).toBe('b');
  });

  it('renders into a shadow root', () => {
    const host = createContainer();
    const shadowRoot = host.attachShadow({ mode: 'open' });

    render(shadowRoot, divTemplate('shadow', 'a'));

    expect(shadowRoot.querySelector('div')?.textContent).toBe('shadow');

    render(shadowRoot, null);

    expect(shadowRoot.childNodes.length).toBe(0);
  });

  it('renders into a document fragment', () => {
    const fragment = document.createDocumentFragment();

    render(fragment, divTemplate('fragment', 'a'));

    expect(fragment.querySelector('div')?.textContent).toBe('fragment');

    render(fragment, null);

    expect(fragment.childNodes.length).toBe(0);
  });

  it('binds event listeners declared in the template', () => {
    const container = createContainer();
    const onClick = vi.fn();

    render(container, html`<button @click=${onClick}>click</button>`);
    container.querySelector('button')?.dispatchEvent(new Event('click'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('accepts a css template literal but renders no nodes for it', () => {
    const container = createContainer();

    render(
      container,
      css`
        .a {
          color: red;
        }
      `
    );

    expect(container.childNodes.length).toBe(0);
    expect(() => render(container, null)).not.toThrow();
  });

  it('swaps a css template literal for a dom template literal', () => {
    const container = createContainer();

    render(
      container,
      css`
        .b {
          color: blue;
        }
      `
    );
    render(container, divTemplate('after-css', 'a'));

    expect(container.textContent).toBe('after-css');
  });

  it('renders nested templates and updates the nested part in place', () => {
    const container = createContainer();
    const nested = (text: string) =>
      html`<section>${html`<em>${text}</em>`}</section>`;

    render(container, nested('one'));
    const em = container.querySelector('em');
    expect(em?.textContent).toBe('one');

    render(container, nested('two'));

    expect(container.querySelector('em')).toBe(em);
    expect(container.querySelector('em')?.textContent).toBe('two');
  });

  it('renders arrays of templates', () => {
    const container = createContainer();
    const list = (items: string[]) =>
      html`<ul>
        ${items.map(item => html`<li>${item}</li>`)}
      </ul>`;

    render(container, list(['a', 'b']));

    expect(
      Array.from(container.querySelectorAll('li')).map(li => li.textContent)
    ).toEqual(['a', 'b']);

    render(container, list(['a', 'b', 'c']));

    expect(
      Array.from(container.querySelectorAll('li')).map(li => li.textContent)
    ).toEqual(['a', 'b', 'c']);
  });
});
