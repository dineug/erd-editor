import { afterEach, describe, expect, it } from 'vitest';

import { ContainerPart } from '@/render/part/container';
import { css } from '@/template/css';
import { html, svg } from '@/template/html';

const containers: HTMLElement[] = [];

function createContainer() {
  const container = document.createElement('div');
  document.body.append(container);
  containers.push(container);
  return container;
}

afterEach(() => {
  let container = containers.pop();
  while (container) {
    container.remove();
    container = containers.pop();
  }
});

describe('ContainerPart', () => {
  it('inserts its fragment as children and commits values', () => {
    const container = createContainer();
    const tl = html`<div id=${'the-id'}>${'body'}</div>`;
    const part = new ContainerPart(tl);

    part.insert('children', container);
    part.commit(tl.values);

    const div = container.querySelector('div') as HTMLElement;
    expect(div.getAttribute('id')).toBe('the-id');
    expect(div.textContent).toBe('body');
    // start/end markers wrap the rendered content
    expect(container.firstChild?.nodeType).toBe(Node.COMMENT_NODE);
    expect(container.lastChild?.nodeType).toBe(Node.COMMENT_NODE);
  });

  it('re-commits new values into the same DOM nodes', () => {
    const container = createContainer();
    const build = (id: string, body: string) => html`<i id=${id}>${body}</i>`;
    const first = build('a', 'one');
    const part = new ContainerPart(first);

    part.insert('children', container);
    part.commit(first.values);
    const node = container.querySelector('i') as HTMLElement;

    const second = build('b', 'two');
    part.commit(second.values);

    expect(container.querySelector('i')).toBe(node);
    expect(node.getAttribute('id')).toBe('b');
    expect(node.textContent).toBe('two');
  });

  it('reports whether the strings array matches', () => {
    const build = (v: string) => html`<span>${v}</span>`;
    const a = build('a');
    const b = build('b');
    const other = html`<span>other</span>`;
    const part = new ContainerPart(a);

    expect(part.equalStrings(a.strings)).toBe(true);
    expect(part.equalStrings(b.strings)).toBe(true);
    expect(part.equalStrings(other.strings)).toBe(false);
  });

  it('inserts before a reference node', () => {
    const container = createContainer();
    const ref = document.createElement('hr');
    container.append(ref);
    const tl = html`<b>before</b>`;
    const part = new ContainerPart(tl);

    part.insert('before', ref);

    expect(container.lastChild).toBe(ref);
    expect(container.querySelector('b')?.textContent).toBe('before');
  });

  it('inserts after a reference node that has a next sibling', () => {
    const container = createContainer();
    const ref = document.createElement('hr');
    const tail = document.createElement('em');
    container.append(ref, tail);
    const tl = html`<b>after</b>`;
    const part = new ContainerPart(tl);

    part.insert('after', ref);

    expect(container.firstChild).toBe(ref);
    expect(container.lastChild).toBe(tail);
    const b = container.querySelector('b') as HTMLElement;
    expect(
      b.compareDocumentPosition(tail) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('appends when inserting after the last child', () => {
    const container = createContainer();
    const ref = document.createElement('hr');
    container.append(ref);
    const tl = html`<b>tail</b>`;
    const part = new ContainerPart(tl);

    part.insert('after', ref);

    expect(container.firstChild).toBe(ref);
    expect(container.querySelector('b')?.textContent).toBe('tail');
  });

  it('ignores a second insert because the fragment is consumed', () => {
    const containerA = createContainer();
    const containerB = createContainer();
    const tl = html`<b>once</b>`;
    const part = new ContainerPart(tl);

    part.insert('children', containerA);
    part.insert('children', containerB);

    expect(containerA.querySelector('b')).not.toBeNull();
    expect(containerB.childNodes.length).toBe(0);
  });

  it('removes its nodes and markers on destroy', () => {
    const container = createContainer();
    const tl = html`<div>${'gone'}</div>`;
    const part = new ContainerPart(tl);

    part.insert('children', container);
    part.commit(tl.values);
    expect(container.textContent).toBe('gone');

    part.destroy();

    expect(container.childNodes.length).toBe(0);
  });

  it('keeps injected start/end nodes on destroy', () => {
    const container = createContainer();
    const startNode = document.createComment('start');
    const endNode = document.createComment('end');
    container.append(startNode, endNode);
    const tl = html`<div>${'injected'}</div>`;
    const part = new ContainerPart(tl, startNode, endNode);

    part.insert('before', endNode);
    part.commit(tl.values);
    expect(container.textContent).toBe('injected');

    part.destroy();

    expect(container.childNodes.length).toBe(2);
    expect(container.childNodes[0]).toBe(startNode);
    expect(container.childNodes[1]).toBe(endNode);
  });

  it('renders svg templates in the svg namespace', () => {
    const container = createContainer();
    const tl = svg`<circle cx=${'5'}></circle>`;
    const part = new ContainerPart(tl);

    part.insert('children', container);
    part.commit(tl.values);

    const circle = container.querySelector('circle') as Element;
    expect(circle.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(circle.getAttribute('cx')).toBe('5');
  });

  it('builds nothing for css template literals', () => {
    const container = createContainer();
    const tl = css`
      .a {
        color: ${'red'};
      }
    `;
    const part = new ContainerPart(tl);

    expect(part.equalStrings(tl.strings)).toBe(true);

    part.insert('children', container);
    part.commit(tl.values);
    expect(container.childNodes.length).toBe(0);

    expect(() => part.destroy()).not.toThrow();
    expect(container.childNodes.length).toBe(0);
  });
});
