import { afterEach, describe, expect, it } from 'vite-plus/test';

import { html, nextTick, render } from '@/index';
import { repeat } from '@/render/directives/node/repeat';

type RepeatValue = [
  any[],
  (value: any) => any,
  (value: any, index: number, array: any[]) => any,
];

type RepeatTuple = [
  RepeatValue,
  (props: {
    startNode: Comment;
    endNode: Comment;
  }) => (value: RepeatValue) => (() => void) | void,
];

const asTuple = (value: unknown) => value as unknown as RepeatTuple;

const hosts: HTMLElement[] = [];

function createDriver() {
  const container = document.createElement('div');
  const startNode = document.createComment('');
  const endNode = document.createComment('');
  container.append(startNode, endNode);
  document.body.append(container);
  hosts.push(container);

  const directive = asTuple(
    repeat<any>(
      [],
      v => v,
      v => v
    )
  )[1]({
    startNode,
    endNode,
  });

  const commit = (
    list: any[],
    getKey: (value: any) => any = value => value,
    getResult: (value: any, index: number, array: any[]) => any = value => value
  ) => directive(asTuple(repeat(list, getKey, getResult))[0]);

  return { container, startNode, endNode, commit };
}

afterEach(() => {
  hosts.splice(0).forEach(host => host.remove());
});

describe('repeat value function', () => {
  it('passes the list and both callbacks through untouched', () => {
    const list = ['a'];
    const getKey = (value: string) => value;
    const getResult = (value: string) => value;

    const [value] = asTuple(repeat(list, getKey, getResult));

    expect(value[0]).toBe(list);
    expect(value[1]).toBe(getKey);
    expect(value[2]).toBe(getResult);
  });
});

describe('repeat directive', () => {
  it('renders one part per item, in list order', () => {
    const { container, commit } = createDriver();

    commit(
      ['a', 'b', 'c'],
      v => v,
      v => v.toUpperCase()
    );

    expect(container.textContent).toBe('ABC');
  });

  it('renders nothing for an empty list', () => {
    const { container, startNode, endNode, commit } = createDriver();

    commit([]);

    expect(container.textContent).toBe('');
    expect(container.firstChild).toBe(startNode);
    expect(container.lastChild).toBe(endNode);
  });

  it('passes value, index and the source array to getResult', () => {
    const { container, commit } = createDriver();
    const list = ['x', 'y'];
    const seen: Array<[string, number, string[]]> = [];

    commit(
      list,
      v => v,
      (value, index, array) => {
        seen.push([value, index, array]);
        return `${value}${index}`;
      }
    );

    expect(seen).toEqual([
      ['x', 0, list],
      ['y', 1, list],
    ]);
    expect(container.textContent).toBe('x0y1');
  });

  it('moves existing parts instead of rebuilding when the list is reordered', () => {
    const { container, commit } = createDriver();
    const toUpper = (v: string) => v.toUpperCase();

    commit(['a', 'b', 'c'], v => v, toUpper);
    commit(['c', 'a', 'b'], v => v, toUpper);

    expect(container.textContent).toBe('CAB');
  });

  it('appends new items at the tail', () => {
    const { container, commit } = createDriver();

    commit(['a']);
    commit(['a', 'b', 'c']);

    expect(container.textContent).toBe('abc');
  });

  it('prepends new items at the head', () => {
    const { container, startNode, commit } = createDriver();

    commit(['b']);
    commit(['a', 'b']);

    expect(container.textContent).toBe('ab');
    expect(startNode.nextSibling?.nodeType).toBe(Node.COMMENT_NODE);
  });

  it('removes the parts whose keys disappeared', () => {
    const { container, commit } = createDriver();

    commit(['a', 'b', 'c']);
    commit(['a', 'c']);

    expect(container.textContent).toBe('ac');
  });

  it('reuses a part when the key survives but the rendered value changes', () => {
    const { container, commit } = createDriver();
    const getKey = (item: { id: number; label: string }) => item.id;
    const getResult = (item: { id: number; label: string }) => item.label;

    commit([{ id: 1, label: 'one' }], getKey, getResult);
    const textNode = container.childNodes[2];
    commit([{ id: 1, label: 'ONE' }], getKey, getResult);

    expect(container.textContent).toBe('ONE');
    expect(container.childNodes[2]).toBe(textNode);
  });

  it('keys parts independently from their rendered value', () => {
    const { container, commit } = createDriver();
    const getKey = (item: { id: number; label: string }) => item.id;
    const getResult = (item: { id: number; label: string }) => item.label;

    commit(
      [
        { id: 1, label: 'one' },
        { id: 2, label: 'two' },
      ],
      getKey,
      getResult
    );
    commit(
      [
        { id: 2, label: 'TWO' },
        { id: 1, label: 'ONE' },
      ],
      getKey,
      getResult
    );

    expect(container.textContent).toBe('TWOONE');
  });

  it('replaces parts when the rendered part type changes for the same key', () => {
    const { container, commit } = createDriver();

    commit(
      ['a'],
      v => v,
      v => v
    );
    commit(
      ['a'],
      v => v,
      v => html`<b>${v}</b>`
    );

    expect(container.querySelector('b')?.textContent).toBe('a');
    expect(container.textContent).toBe('a');
  });

  it('supports template literal results and destroys removed ones', () => {
    const { container, commit } = createDriver();
    const getResult = (v: number) => html`<span>${v}</span>`;

    commit([1, 2, 3], v => v, getResult);
    expect(container.querySelectorAll('span')).toHaveLength(3);
    expect(container.textContent).toBe('123');

    commit([3, 1], v => v, getResult);
    expect(container.querySelectorAll('span')).toHaveLength(2);
    expect(container.textContent).toBe('31');
  });

  it('returns a stable destroy that clears every rendered part', () => {
    const { container, startNode, endNode, commit } = createDriver();

    const first = commit(['a', 'b']);
    const destroy = commit(['a', 'b', 'c']) as () => void;
    expect(destroy).toBe(first);

    destroy();

    expect(container.textContent).toBe('');
    expect(container.firstChild).toBe(startNode);
    expect(container.lastChild).toBe(endNode);
  });

  it('destroys template literal parts too', () => {
    const { container, commit } = createDriver();

    const destroy = commit(
      [1, 2],
      v => v,
      v => html`<span>${v}</span>`
    ) as () => void;

    destroy();

    expect(container.querySelectorAll('span')).toHaveLength(0);
    expect(container.textContent).toBe('');
  });

  it('renders through the template pipeline and reorders in place', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const view = (items: string[]) =>
      html`<ul>
        ${repeat(
          items,
          v => v,
          v => html`<li>${v}</li>`
        )}
      </ul>`;

    render(container, view(['a', 'b']));
    await nextTick(() => {});
    const items = () =>
      Array.from(container.querySelectorAll('li')).map(li => li.textContent);
    expect(items()).toEqual(['a', 'b']);
    const firstLi = container.querySelector('li');

    render(container, view(['b', 'a']));
    await nextTick(() => {});
    expect(items()).toEqual(['b', 'a']);
    expect(container.querySelectorAll('li')[1]).toBe(firstLi);

    render(container, null);
    expect(container.querySelectorAll('li')).toHaveLength(0);
    container.remove();
  });
});
