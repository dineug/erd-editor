import { afterEach, describe, expect, it } from 'vite-plus/test';

import { TextPart } from '@/render/part/node/text/index';
import { DOMTemplateLiterals } from '@/template';
import { html } from '@/template/html';
import { TNode } from '@/template/tNode';

function setup(templateLiterals: DOMTemplateLiterals, index = 0) {
  const container = document.createElement('div');
  document.body.append(container);

  const tNode = (templateLiterals.template.node.children as TNode[])[index];
  const node = document.createTextNode(tNode.value);
  container.append(node);

  return { container, node, part: new TextPart(node, tNode) };
}

const marker = () => html`${'x'}`;
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

afterEach(() => {
  document.body.replaceChildren();
});

describe('TextPart', () => {
  it('replaces the marker text node with a comment boundary pair', () => {
    const { container, node } = setup(marker());

    expect(node.parentNode).toBeNull();
    expect(container.childNodes).toHaveLength(2);
    expect(container.firstChild?.nodeType).toBe(Node.COMMENT_NODE);
    expect(container.lastChild?.nodeType).toBe(Node.COMMENT_NODE);
  });

  it('renders the value of its own marker index', () => {
    const { container, part } = setup(html`${'a'}${'b'}`, 1);

    part.commit(['A', 'B']);

    expect(container.textContent).toBe('B');
  });

  it('renders primitives through a text node', () => {
    const { container, part } = setup(marker());

    part.commit(['hello']);
    expect(container.textContent).toBe('hello');

    part.commit([42]);
    expect(container.textContent).toBe('42');

    part.commit([undefined]);
    expect(container.textContent).toBe('');
  });

  it('reuses the same part instance while the value type does not change', () => {
    const { container, part } = setup(marker());

    part.commit(['a']);
    const textNode = container.childNodes[1];

    part.commit(['b']);

    expect(container.childNodes[1]).toBe(textNode);
    expect(container.textContent).toBe('b');
  });

  it('skips the commit when the value is unchanged', () => {
    const { container, part } = setup(marker());

    part.commit(['same']);
    const textNode = container.childNodes[1] as Text;
    textNode.data = 'externally changed';

    part.commit(['same']);
    expect(container.textContent).toBe('externally changed');

    part.commit(['other']);
    expect(container.textContent).toBe('other');
  });

  it('ignores the very first null commit because the initial value is null', () => {
    const { container, part } = setup(marker());

    part.commit([null]);
    expect(container.childNodes).toHaveLength(2);

    part.commit(['now rendered']);
    expect(container.textContent).toBe('now rendered');
  });

  it('renders a nested template literal', () => {
    const { container, part } = setup(marker());

    part.commit([html`<b>bold</b>`]);

    expect(container.querySelector('b')?.textContent).toBe('bold');
  });

  it('renders arrays item by item', () => {
    const { container, part } = setup(marker());

    part.commit([['a', 'b']]);
    expect(container.textContent).toBe('ab');

    part.commit([['a', 'b', 'c']]);
    expect(container.textContent).toBe('abc');
  });

  it('appends a committed dom node', () => {
    const { container, part } = setup(marker());
    const span = document.createElement('span');
    span.textContent = 'S';

    part.commit([span]);

    expect(container.querySelector('span')).toBe(span);
  });

  it('renders nothing for functions', () => {
    const { container, part } = setup(marker());

    part.commit([() => 'ignored']);

    expect(container.textContent).toBe('');
    expect(container.childNodes).toHaveLength(2);
  });

  it('renders the resolved value of a promise', async () => {
    const { container, part } = setup(marker());

    part.commit([Promise.resolve('resolved')]);
    expect(container.textContent).toBe('');

    await tick();

    expect(container.textContent).toBe('resolved');
  });

  it('swaps the part when the value type changes and clears the previous output', () => {
    const { container, part } = setup(marker());

    part.commit(['text']);
    expect(container.textContent).toBe('text');

    part.commit([html`<b>bold</b>`]);
    expect(container.textContent).toBe('bold');
    expect(container.childNodes).toHaveLength(3);

    part.commit([['x', 'y']]);
    expect(container.querySelector('b')).toBeNull();
    expect(container.textContent).toBe('xy');

    const span = document.createElement('span');
    span.textContent = 'S';
    part.commit([span]);
    expect(container.textContent).toBe('S');

    part.commit([() => {}]);
    expect(container.textContent).toBe('');
    expect(container.childNodes).toHaveLength(2);
  });

  it('clear empties the range but keeps the boundary comments', () => {
    const { container, part } = setup(marker());

    part.commit([html`<b>bold</b>`]);
    part.clear();

    expect(container.childNodes).toHaveLength(2);
    expect(container.textContent).toBe('');
  });

  it('destroy removes the rendered output and both boundary comments', () => {
    const { container, part } = setup(marker());

    part.commit(['bye']);
    part.destroy();

    expect(container.childNodes).toHaveLength(0);
  });

  it('throws on commit when the text node holds no marker', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const node = document.createTextNode('static');
    container.append(node);
    const part = new TextPart(node, { value: 'static' } as TNode);

    expect(() => part.commit(['x'])).toThrow();
  });
});
