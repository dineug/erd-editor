import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createElement, createTemplate, Part } from '@/render/part';
import { AttributePart } from '@/render/part/attribute/attribute';
import { EventPart } from '@/render/part/attribute/event';
import { CommentPart } from '@/render/part/node/comment';
import { TextPart } from '@/render/part/node/text';
import { html, svg } from '@/template/html';
import { TNode } from '@/template/tNode';

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

const rootChildren = (node: TNode) => node.children ?? [];

describe('render/part createElement', () => {
  it('returns an empty part list when there are no children', () => {
    const fragment = document.createDocumentFragment();

    const parts = createElement(undefined, fragment);

    expect(parts).toEqual([]);
    expect(fragment.childNodes.length).toBe(0);
  });

  it('builds static elements with static attributes and nested children', () => {
    const tl = html`<div id="root" data-a="1"><span>hi</span></div>`;
    const fragment = document.createDocumentFragment();

    const parts = createElement(rootChildren(tl.template.node), fragment);

    expect(parts).toEqual([]);
    const div = fragment.childNodes[0] as HTMLElement;
    expect(div.tagName).toBe('DIV');
    expect(div.getAttribute('id')).toBe('root');
    expect(div.getAttribute('data-a')).toBe('1');
    expect(div.querySelector('span')?.textContent).toBe('hi');
  });

  it('appends into an existing parts array and returns the same reference', () => {
    const tl = html`<div id=${'a'}></div>`;
    const fragment = document.createDocumentFragment();
    const seed: Part[] = [];

    const parts = createElement(
      rootChildren(tl.template.node),
      fragment,
      false,
      seed
    );

    expect(parts).toBe(seed);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toBeInstanceOf(AttributePart);
  });

  it('creates a CommentPart for a marker comment node', () => {
    const tl = html`<!-- value: ${'x'} -->`;
    const fragment = document.createDocumentFragment();

    const parts = createElement(rootChildren(tl.template.node), fragment);

    expect(parts).toHaveLength(1);
    expect(parts[0]).toBeInstanceOf(CommentPart);

    const comment = fragment.childNodes[0] as Comment;
    parts[0].commit(['42']);
    expect(comment.data).toBe(' value: 42 ');
  });

  it('does not create a CommentPart for a plain comment node', () => {
    const tl = html`<!-- plain -->`;
    const fragment = document.createDocumentFragment();

    const parts = createElement(rootChildren(tl.template.node), fragment);

    expect(parts).toEqual([]);
    expect((fragment.childNodes[0] as Comment).data).toBe(' plain ');
  });

  it('creates a TextPart for a marker-only text node and removes the text node', () => {
    const container = createContainer();
    const tl = html`<div>text ${'value'}</div>`;
    const fragment = document.createDocumentFragment();

    const parts = createElement(rootChildren(tl.template.node), fragment);
    container.appendChild(fragment);

    expect(parts).toHaveLength(1);
    expect(parts[0]).toBeInstanceOf(TextPart);

    const div = container.firstElementChild as HTMLElement;
    // the marker text node is replaced with a start/end comment pair
    expect(div.childNodes.length).toBe(3);
    expect(div.childNodes[0].nodeType).toBe(Node.TEXT_NODE);
    expect(div.childNodes[1].nodeType).toBe(Node.COMMENT_NODE);
    expect(div.childNodes[2].nodeType).toBe(Node.COMMENT_NODE);

    parts[0].commit(['value']);
    expect(div.textContent).toBe('text value');
  });

  it('creates attribute parts for dynamic attributes only', () => {
    const container = createContainer();
    const tl = html`<div
      id="static"
      title=${'dynamic'}
      @click=${'handler'}
    ></div>`;
    const fragment = document.createDocumentFragment();

    const parts = createElement(rootChildren(tl.template.node), fragment);
    container.appendChild(fragment);

    expect(parts).toHaveLength(2);
    expect(parts[0]).toBeInstanceOf(AttributePart);
    expect(parts[1]).toBeInstanceOf(EventPart);

    const div = container.firstElementChild as HTMLElement;
    expect(div.getAttribute('id')).toBe('static');

    let clicked = 0;
    parts.forEach(part => part.commit(['dynamic-title', () => clicked++]));
    expect(div.getAttribute('title')).toBe('dynamic-title');

    div.dispatchEvent(new Event('click'));
    expect(clicked).toBe(1);
  });

  it('creates svg namespaced elements when isSvg is set', () => {
    const tl = svg`<circle cx=${'1'}></circle>`;
    const fragment = document.createDocumentFragment();

    createElement(rootChildren(tl.template.node), fragment, true);

    const circle = fragment.childNodes[0] as Element;
    expect(circle.namespaceURI).toBe('http://www.w3.org/2000/svg');
  });

  it('propagates the svg namespace to children of an <svg> node', () => {
    const tl = html`<div>
      <svg><circle></circle></svg>
    </div>`;
    const fragment = document.createDocumentFragment();

    createElement(rootChildren(tl.template.node), fragment, false);

    const div = fragment.childNodes[0] as Element;
    expect(div.namespaceURI).toBe('http://www.w3.org/1999/xhtml');
    const svgEl = div.childNodes[0] as Element;
    expect(svgEl.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect((svgEl.childNodes[0] as Element).namespaceURI).toBe(
      'http://www.w3.org/2000/svg'
    );
  });

  it('creates a ComponentPart for a marker-only element and renders it', () => {
    const container = createContainer();
    const Comp = () => () => html`<b>component</b>`;
    const tl = html`<${Comp}></${Comp}>`;
    const fragment = document.createDocumentFragment();

    const parts = createElement(rootChildren(tl.template.node), fragment);
    container.appendChild(fragment);

    expect(parts).toHaveLength(1);

    parts[0].commit([Comp, Comp]);
    expect(container.textContent).toBe('component');
    expect(container.querySelector('b')).not.toBeNull();

    parts[0].destroy?.();
    expect(container.querySelector('b')).toBeNull();
  });
});

describe('render/part createTemplate', () => {
  it('returns a fragment plus the collected parts', () => {
    const tl = html`<div id=${'a'}>${'body'}</div>`;

    const [fragment, parts] = createTemplate(tl.template.node);

    expect(fragment).toBeInstanceOf(DocumentFragment);
    expect(fragment.childNodes.length).toBe(1);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toBeInstanceOf(AttributePart);
    expect(parts[1]).toBeInstanceOf(TextPart);
  });

  it('honours the isSvg flag for the root children', () => {
    const tl = svg`<circle></circle>`;

    const [fragment] = createTemplate(tl.template.node, true);

    expect((fragment.childNodes[0] as Element).namespaceURI).toBe(
      'http://www.w3.org/2000/svg'
    );
  });

  it('defaults isSvg to false', () => {
    const tl = html`<div></div>`;

    const [fragment] = createTemplate(tl.template.node);

    expect((fragment.childNodes[0] as Element).namespaceURI).toBe(
      'http://www.w3.org/1999/xhtml'
    );
  });
});
