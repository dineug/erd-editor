import { describe, expect, it, vi } from 'vite-plus/test';

import { DIRECTIVE } from '@/constants';
import { html, nextTick, render } from '@/index';
import { DirectiveType } from '@/render/directives';
import { createAttributeDirective } from '@/render/directives/attributeDirective';

type Fn = (name: string, enabled: boolean) => string;

describe('createAttributeDirective', () => {
  it('returns a factory that tags its tuple as an attribute directive', () => {
    const f = vi.fn((name: string, enabled: boolean) =>
      enabled ? name : `no-${name}`
    );
    const creator = vi.fn(() => () => {});
    const directive = createAttributeDirective<Fn>(f, creator);

    const tuple = directive('active', true);

    expect(Reflect.get(tuple, DIRECTIVE)).toBe(DirectiveType.attribute);
    expect(tuple[0]).toBe('active');
    expect(tuple[1]).toBe(creator);
    expect(f).toHaveBeenCalledWith('active', true);
  });

  it('passes every argument through to the value function', () => {
    const creator = vi.fn(() => () => {});
    const directive = createAttributeDirective<Fn>(
      (name, enabled) => (enabled ? name : `no-${name}`),
      creator
    );

    expect(directive('active', false)[0]).toBe('no-active');
  });

  it('does not invoke the directive creator while building the tuple', () => {
    const creator = vi.fn(() => () => {});
    const directive = createAttributeDirective<Fn>(name => name, creator);

    directive('active', true);

    expect(creator).not.toHaveBeenCalled();
  });

  it('builds a fresh tuple per call but keeps the creator identity stable', () => {
    const creator = vi.fn(() => () => {});
    const directive = createAttributeDirective<Fn>(name => name, creator);

    const first = directive('active', true);
    const second = directive('active', true);

    expect(first).not.toBe(second);
    expect(first[1]).toBe(second[1]);
  });

  it('receives the element it is attached to when rendered', async () => {
    const nodes: any[] = [];
    const addClass = createAttributeDirective(
      (name: string) => name,
      ({ node }) => {
        nodes.push(node);
        let prev: string | null = null;

        const destroy = () => {
          prev && node.classList.remove(prev);
        };

        return (name: string) => {
          destroy();
          node.classList.add(name);
          prev = name;
          return destroy;
        };
      }
    );

    const view = (name: string) => html`<div ${addClass(name)}></div>`;
    const container = document.createElement('div');
    document.body.append(container);

    render(container, view('one'));
    await nextTick(() => {});

    const el = container.querySelector('div') as HTMLDivElement;
    expect(nodes).toEqual([el]);
    expect(el.className).toBe('one');

    render(container, view('two'));
    await nextTick(() => {});

    expect(nodes).toHaveLength(1);
    expect(el.className).toBe('two');

    render(container, null);
    expect(el.className).toBe('');
    container.remove();
  });
});
