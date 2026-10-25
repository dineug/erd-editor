// A registry keeps a definition for the life of the file, so the tag is taken
// here, apart from the specs that define it, and before the element module
// is first evaluated.

import { describe, expect, it } from 'vite-plus/test';

class OtherElement extends HTMLElement {}

customElements.define('erd-viewer', OtherElement);

const { defineErdViewer } = await import('@/components/erd-viewer/ErdViewer');

const errorOf = (run: () => void): unknown => {
  try {
    run();
  } catch (error) {
    return error;
  }
  return undefined;
};

describe('defineErdViewer on a tag another class holds', () => {
  it('throws its own Error naming the tag before the registry would refuse', () => {
    const error = errorOf(defineErdViewer);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).name).toBe('Error');
    expect((error as Error).message).toContain('erd-viewer');
  });

  it('leaves the other class holding the tag', () => {
    expect(errorOf(defineErdViewer)).toBeInstanceOf(Error);
    expect(customElements.get('erd-viewer')).toBe(OtherElement);
  });
});
