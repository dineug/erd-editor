import { describe, expect, it } from 'vitest';

import * as styles from '@/components/toast-container/ToastContainer.styles';

describe('ToastContainer.styles', () => {
  it('exposes `root` as a css template compiled to a class identifier', () => {
    expect(styles.root).toBeTruthy();
    expect(String(styles.root)).toMatch(/\S/);
    expect(String(styles.root)).toBe(String(styles.root));
    expect(styles.root.values).toEqual([]);
  });

  it('pins the stack to the bottom right above everything else', () => {
    const source = styles.root.strings.join('');

    expect(source).toContain('position: absolute');
    expect(source).toContain('z-index: 2147483647');
    expect(source).toContain('bottom: 0');
    expect(source).toContain('right: 0');
    expect(source).toContain('max-width: 390px');
    expect(source).toContain('flex-direction: column');
  });

  it('declares the data attribute hooks the component toggles', () => {
    const source = styles.root.strings.join('');

    expect(source).toContain('&[data-pointer-none]');
    expect(source).toContain('pointer-events: none');
    expect(source).toContain('&[data-animation-one]');
    expect(source).toContain('animation: none');
  });

  it('declares the flip move class used by useFlipAnimation', () => {
    const source = styles.root.strings.join('');

    expect(source).toContain('.toast-move');
    expect(source).toContain('transition: transform 0.3s');
  });

  it('declares the toast entry animation and its keyframes', () => {
    const source = styles.root.strings.join('');

    expect(source).toContain('.toast-container');
    expect(source).toContain('animation: toastShowMove 0.3s ease');
    expect(source).toContain('.toast-container:first-child');
    expect(source).toContain('@keyframes toastShowMove');
    expect(source).toContain('translateY(30px)');
    expect(source).toContain('translateY(0)');
  });
});
