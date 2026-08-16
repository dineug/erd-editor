import { describe, expect, it } from 'vite-plus/test';

import * as attributeDirectives from '@/render/directives/attribute';
import { createRef, ref } from '@/render/directives/attribute/ref';

describe('attribute directives barrel', () => {
  it('re-exports the ref helpers by identity', () => {
    expect(attributeDirectives.createRef).toBe(createRef);
    expect(attributeDirectives.ref).toBe(ref);
  });

  it('exposes only the public attribute directive surface', () => {
    expect(Object.keys(attributeDirectives).sort()).toEqual([
      'createRef',
      'ref',
    ]);
  });

  it('still works as a directive when reached through the barrel', () => {
    const node = document.createElement('div');
    const refObject = attributeDirectives.createRef<HTMLElement>();
    const tuple = attributeDirectives.ref(refObject) as unknown as [
      any,
      (props: { node: any }) => (value: any) => (() => void) | void,
    ];

    tuple[1]({ node })(tuple[0]);

    expect(refObject.value).toBe(node);
  });
});
