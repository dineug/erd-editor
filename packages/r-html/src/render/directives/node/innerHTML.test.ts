import { afterEach, describe, expect, it } from 'vitest';

import { html, nextTick, render } from '@/index';
import { innerHTML } from '@/render/directives/node/innerHTML';

const hosts: HTMLElement[] = [];

function createHost() {
  const container = document.createElement('div');
  const startNode = document.createComment('');
  const endNode = document.createComment('');
  container.append(startNode, endNode);
  document.body.append(container);
  hosts.push(container);

  const directive = innerHTML('')[1]({ startNode, endNode });
  const commit = (value: string) => directive(innerHTML(value)[0]);

  return { container, startNode, endNode, commit };
}

afterEach(() => {
  hosts.splice(0).forEach(host => host.remove());
});

describe('innerHTML directive', () => {
  it('parses the string and inserts the nodes between the markers', () => {
    const { container, endNode, commit } = createHost();

    commit('<b>hi</b><i>there</i>');

    const b = container.querySelector('b');
    expect(b?.textContent).toBe('hi');
    expect(container.textContent).toBe('hithere');
    expect(container.lastChild).toBe(endNode);
  });

  it('replaces the previous markup when the value changes', () => {
    const { container, commit } = createHost();

    commit('<b>one</b>');
    commit('<i>two</i>');

    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('i')?.textContent).toBe('two');
    expect(container.textContent).toBe('two');
  });

  it('skips reparsing when the same string is committed twice', () => {
    const { container, commit } = createHost();

    commit('<b>same</b>');
    const b = container.querySelector('b') as HTMLElement;
    b.setAttribute('data-touched', 'yes');
    commit('<b>same</b>');

    expect(container.querySelector('b')).toBe(b);
    expect(b.getAttribute('data-touched')).toBe('yes');
  });

  it('returns the same destroy function on every commit', () => {
    const { commit } = createHost();

    const first = commit('<b>a</b>');
    const second = commit('<b>b</b>');
    const third = commit('<b>b</b>');

    expect(typeof first).toBe('function');
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it('removes everything between the markers on destroy but keeps them', () => {
    const { container, startNode, endNode, commit } = createHost();

    const destroy = commit('<b>a</b><b>b</b>') as () => void;
    destroy();

    expect(container.textContent).toBe('');
    expect(container.querySelectorAll('b')).toHaveLength(0);
    expect(container.firstChild).toBe(startNode);
    expect(container.lastChild).toBe(endNode);
  });

  it('does not re-render after destroy when the value is unchanged', () => {
    const { container, commit } = createHost();

    const destroy = commit('<b>a</b>') as () => void;
    destroy();
    commit('<b>a</b>');

    // prevValue is still set, so the memoised early return wins and nothing
    // is restored
    expect(container.textContent).toBe('');
  });

  it('accepts plain text as well as markup', () => {
    const { container, commit } = createHost();

    commit('just text');

    expect(container.textContent).toBe('just text');
    expect(container.children).toHaveLength(0);
  });

  it('renders through the template pipeline and cleans up on unmount', async () => {
    const container = document.createElement('div');
    document.body.append(container);

    render(container, html`<div>${innerHTML('<span>x</span>')}</div>`);
    await nextTick(() => {});
    expect(container.querySelector('span')?.textContent).toBe('x');

    render(container, html`<div>${innerHTML('<em>y</em>')}</div>`);
    await nextTick(() => {});
    expect(container.querySelector('span')).toBeNull();
    expect(container.querySelector('em')?.textContent).toBe('y');

    render(container, null);
    expect(container.textContent).toBe('');
    container.remove();
  });
});
