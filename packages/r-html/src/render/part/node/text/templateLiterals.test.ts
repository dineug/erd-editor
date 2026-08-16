import { afterEach, describe, expect, it } from 'vite-plus/test';

import { TemplateLiteralsPart } from '@/render/part/node/text/templateLiterals';
import { TemplateLiterals } from '@/template';
import { css } from '@/template/css';
import { html } from '@/template/html';

function setup() {
  const container = document.createElement('div');
  const startNode = document.createComment('start');
  const endNode = document.createComment('end');
  container.append(startNode, endNode);
  document.body.append(container);

  return {
    container,
    startNode,
    endNode,
    part: new TemplateLiteralsPart(startNode, endNode),
  };
}

const span = (value: string) => html`<span>${value}</span>`;

afterEach(() => {
  document.body.replaceChildren();
});

describe('TemplateLiteralsPart', () => {
  it('renders the template between the start and the end node', () => {
    const { container, startNode, endNode, part } = setup();

    part.commit(html`<div class="box">hi</div>`);

    const rendered = container.querySelector('.box') as HTMLElement;
    expect(rendered).not.toBeNull();
    expect(rendered.textContent).toBe('hi');
    expect(rendered.previousSibling).toBe(startNode);
    expect(container.lastChild).toBe(endNode);
  });

  it('reuses the rendered nodes when the strings are identical', () => {
    const { container, part } = setup();

    part.commit(span('a'));
    const first = container.querySelector('span');
    expect(first?.textContent).toBe('a');

    part.commit(span('b'));

    expect(container.querySelector('span')).toBe(first);
    expect(container.querySelectorAll('span')).toHaveLength(1);
    expect(first?.textContent).toBe('b');
  });

  it('destroys the previous template when the strings change', () => {
    const { container, part } = setup();

    part.commit(span('a'));
    const first = container.querySelector('span');

    part.commit(html`<p>other</p>`);

    expect(first?.parentNode).toBeNull();
    expect(container.querySelector('span')).toBeNull();
    expect(container.querySelector('p')?.textContent).toBe('other');
  });

  it('destroy removes the rendered nodes but keeps the boundary comments', () => {
    const { container, startNode, endNode, part } = setup();

    part.commit(span('a'));
    part.destroy();

    expect(container.querySelector('span')).toBeNull();
    expect(Array.from(container.childNodes)).toEqual([startNode, endNode]);
  });

  it('destroy before any commit is a no-op', () => {
    const { container, startNode, endNode, part } = setup();

    expect(() => part.destroy()).not.toThrow();
    expect(Array.from(container.childNodes)).toEqual([startNode, endNode]);
  });

  it('does not re-render the same template after destroy', () => {
    const { container, part } = setup();

    part.commit(span('a'));
    part.destroy();
    part.commit(span('b'));

    expect(container.querySelector('span')).toBeNull();
  });

  it('renders nothing for css template literals', () => {
    const { container, startNode, endNode, part } = setup();

    part.commit(
      css`
        .a {
          color: red;
        }
      ` as unknown as TemplateLiterals
    );

    expect(Array.from(container.childNodes)).toEqual([startNode, endNode]);
    expect(() => part.destroy()).not.toThrow();
  });

  it('commits the values of the template to its inner parts', () => {
    const { container, part } = setup();
    const view = (a: string, b: string) =>
      html`<i>${a}</i><em>${b}</em>` as TemplateLiterals;

    part.commit(view('1', '2'));
    expect(container.querySelector('i')?.textContent).toBe('1');
    expect(container.querySelector('em')?.textContent).toBe('2');

    part.commit(view('3', '4'));
    expect(container.querySelector('i')?.textContent).toBe('3');
    expect(container.querySelector('em')?.textContent).toBe('4');
  });
});
