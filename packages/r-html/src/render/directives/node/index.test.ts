import { describe, expect, it } from 'vite-plus/test';

import * as nodeDirectives from '@/render/directives/node';
import { cache } from '@/render/directives/node/cache';
import { innerHTML } from '@/render/directives/node/innerHTML';
import { repeat } from '@/render/directives/node/repeat';

describe('node directives barrel', () => {
  it('re-exports every node directive by identity', () => {
    expect(nodeDirectives.cache).toBe(cache);
    expect(nodeDirectives.innerHTML).toBe(innerHTML);
    expect(nodeDirectives.repeat).toBe(repeat);
  });

  it('exposes only the public node directive surface', () => {
    expect(Object.keys(nodeDirectives).sort()).toEqual([
      'cache',
      'innerHTML',
      'repeat',
    ]);
  });

  it('still works as a directive when reached through the barrel', () => {
    const container = document.createElement('div');
    const startNode = document.createComment('');
    const endNode = document.createComment('');
    container.append(startNode, endNode);
    document.body.append(container);

    const tuple = nodeDirectives.innerHTML('<b>barrel</b>');
    tuple[1]({ startNode, endNode })(tuple[0]);

    expect(container.querySelector('b')?.textContent).toBe('barrel');
    container.remove();
  });
});
