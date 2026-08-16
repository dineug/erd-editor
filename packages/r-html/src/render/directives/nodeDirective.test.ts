import { describe, expect, it, vi } from 'vite-plus/test';

import { DIRECTIVE } from '@/constants';
import { html, nextTick, render } from '@/index';
import { DirectiveType } from '@/render/directives';
import { createNodeDirective } from '@/render/directives/nodeDirective';
import { insertBeforeNode } from '@/render/helper';

type Fn = (text: string, times: number) => string;

describe('createNodeDirective', () => {
  it('returns a factory that tags its tuple as a node directive', () => {
    const f = vi.fn((text: string, times: number) => text.repeat(times));
    const creator = vi.fn(() => () => {});
    const directive = createNodeDirective<Fn>(f, creator);

    const tuple = directive('ab', 2);

    expect(Reflect.get(tuple, DIRECTIVE)).toBe(DirectiveType.node);
    expect(tuple[0]).toBe('abab');
    expect(tuple[1]).toBe(creator);
    expect(f).toHaveBeenCalledWith('ab', 2);
  });

  it('does not invoke the directive creator while building the tuple', () => {
    const creator = vi.fn(() => () => {});
    const directive = createNodeDirective<Fn>((text: string) => text, creator);

    directive('a', 1);

    expect(creator).not.toHaveBeenCalled();
  });

  it('builds a fresh tuple per call but keeps the creator identity stable', () => {
    const creator = vi.fn(() => () => {});
    const directive = createNodeDirective<Fn>((text: string) => text, creator);

    const first = directive('a', 1);
    const second = directive('a', 1);

    expect(first).not.toBe(second);
    expect(first[1]).toBe(second[1]);
  });

  it('receives the surrounding comment markers when rendered', async () => {
    const props: Array<{ startNode: Comment; endNode: Comment }> = [];
    const destroy = vi.fn();
    const text = createNodeDirective(
      (value: string) => value,
      ({ startNode, endNode }) => {
        props.push({ startNode, endNode });
        const node = document.createTextNode('');
        insertBeforeNode(node, endNode);

        return (value: string) => {
          node.data = value;
          return destroy;
        };
      }
    );

    const view = (value: string) => html`<div>${text(value)}</div>`;
    const container = document.createElement('div');
    document.body.append(container);

    render(container, view('one'));
    await nextTick(() => {});

    expect(container.textContent).toBe('one');
    expect(props).toHaveLength(1);
    expect(props[0].startNode.nodeType).toBe(Node.COMMENT_NODE);
    expect(props[0].endNode.nodeType).toBe(Node.COMMENT_NODE);

    render(container, view('two'));
    await nextTick(() => {});

    expect(container.textContent).toBe('two');
    expect(props).toHaveLength(1);
    expect(destroy).not.toHaveBeenCalled();

    render(container, null);

    expect(destroy).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe('');
    container.remove();
  });
});
