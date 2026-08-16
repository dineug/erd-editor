import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { mountAndFlush, Mounted } from '@/__test-utils__/index';
import Slider, { SliderProps } from '@/components/primitives/slider/Slider';
import * as styles from '@/components/primitives/slider/Slider.styles';

let mounted: Mounted | null = null;

afterEach(() => {
  // ends any drag$ subscription a test left open (drag$ = move$ takeUntil moveEnd$)
  window.dispatchEvent(new MouseEvent('mouseup'));
  mounted?.unmount();
  mounted = null;
});

const RECT_LEFT = 20;
const RECT_WIDTH = 200;

function stubRect(el: HTMLElement, x = RECT_LEFT, width = RECT_WIDTH) {
  Reflect.set(el, 'getBoundingClientRect', () => ({
    x,
    y: 0,
    left: x,
    top: 0,
    right: x + width,
    bottom: 12,
    width,
    height: 12,
    toJSON: () => ({}),
  }));
}

async function setup(props: Partial<SliderProps> = {}) {
  const onChange = vi.fn();
  mounted = await mountAndFlush(
    html`<${Slider}
      min=${props.min ?? 0}
      max=${props.max ?? 100}
      value=${props.value ?? 50}
      .onChange=${props.onChange ?? onChange}
    />`
  );

  const root = mounted.container.querySelector(
    `.${String(styles.root)}`
  ) as HTMLDivElement;
  const track = root.querySelector(
    `.${String(styles.track)}`
  ) as HTMLDivElement;
  const range = root.querySelector(
    `.${String(styles.range)}`
  ) as HTMLDivElement;
  const thumb = root.querySelector(
    `.${String(styles.thumb)}`
  ) as HTMLDivElement;
  stubRect(root);

  return { root, track, range, thumb, onChange };
}

const mouse = (type: string, clientX: number) =>
  new MouseEvent(type, { clientX, cancelable: true });

describe('Slider', () => {
  describe('rendering', () => {
    it('renders the root, track, range and thumb layers', async () => {
      const { root, track, range, thumb } = await setup();

      expect(root).toBeTruthy();
      expect(track.contains(range)).toBe(true);
      expect(root.contains(thumb)).toBe(true);
    });

    it('clips the range and offsets the thumb for a mid value', async () => {
      const { range, thumb } = await setup({ min: 0, max: 100, value: 50 });

      expect(range.style.right).toBe('50%');
      expect(thumb.style.left).toBe('calc(50% - 6px)');
    });

    it('collapses the range at the minimum', async () => {
      const { range, thumb } = await setup({ min: 0, max: 100, value: 0 });

      expect(range.style.right).toBe('100%');
      expect(thumb.style.left).toBe('calc(0% - 0px)');
    });

    it('fills the range at the maximum', async () => {
      const { range, thumb } = await setup({ min: 0, max: 100, value: 100 });

      expect(range.style.right).toBe('0%');
      expect(thumb.style.left).toBe('calc(100% - 12px)');
    });

    it('positions against the min/max window rather than raw values', async () => {
      const { range } = await setup({ min: 10, max: 20, value: 12 });

      // (12 - 10) / (20 - 10) = 0.2
      expect(range.style.right).toBe('80%');
    });
  });

  describe('mousedown on the track', () => {
    it('converts the pointer position into a value inside the range', async () => {
      const { root, onChange } = await setup({ min: 0, max: 100, value: 50 });

      root.dispatchEvent(mouse('mousedown', RECT_LEFT + RECT_WIDTH / 4));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(25);
    });

    it('offsets the converted value by min', async () => {
      const { root, onChange } = await setup({ min: 10, max: 20, value: 10 });

      root.dispatchEvent(mouse('mousedown', RECT_LEFT + RECT_WIDTH / 2));

      expect(onChange).toHaveBeenCalledWith(15);
    });

    it('clamps a pointer past the right edge to max', async () => {
      const { root, onChange } = await setup({ min: 0, max: 100, value: 50 });

      root.dispatchEvent(mouse('mousedown', RECT_LEFT + RECT_WIDTH * 3));

      expect(onChange).toHaveBeenCalledWith(100);
    });

    it('clamps a pointer left of the track to min', async () => {
      const { root, onChange } = await setup({ min: 0, max: 100, value: 50 });

      root.dispatchEvent(mouse('mousedown', RECT_LEFT - 500));

      expect(onChange).toHaveBeenCalledWith(0);
    });

    it('does not report a change when the pointer lands on the current value', async () => {
      const { root, onChange } = await setup({ min: 0, max: 100, value: 50 });

      root.dispatchEvent(mouse('mousedown', RECT_LEFT + RECT_WIDTH / 2));

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('dragging', () => {
    it('reports every new value while the mouse moves', async () => {
      const { root, onChange } = await setup({ min: 0, max: 100, value: 50 });

      root.dispatchEvent(mouse('mousedown', RECT_LEFT + RECT_WIDTH / 2));
      window.dispatchEvent(mouse('mousemove', RECT_LEFT + RECT_WIDTH * 0.75));
      window.dispatchEvent(mouse('mousemove', RECT_LEFT + RECT_WIDTH * 0.1));

      expect(onChange.mock.calls).toEqual([[75], [10]]);
    });

    it('prevents the default of a mousemove so the drag does not select text', async () => {
      const { root } = await setup({ min: 0, max: 100, value: 50 });

      root.dispatchEvent(mouse('mousedown', RECT_LEFT + RECT_WIDTH / 2));
      const move = mouse('mousemove', RECT_LEFT + RECT_WIDTH * 0.75);
      window.dispatchEvent(move);

      expect(move.defaultPrevented).toBe(true);
    });

    it('does not preventDefault for a touchmove but still reports the value', async () => {
      const { root, onChange } = await setup({ min: 0, max: 100, value: 50 });

      root.dispatchEvent(mouse('mousedown', RECT_LEFT + RECT_WIDTH / 2));
      const move = new TouchEvent('touchmove', {
        cancelable: true,
        touches: [{ clientX: RECT_LEFT + RECT_WIDTH * 0.3, clientY: 0 }] as any,
      });
      window.dispatchEvent(move);

      expect(move.defaultPrevented).toBe(false);
      expect(onChange).toHaveBeenCalledWith(30);
    });

    it('skips moves that resolve to the value already held', async () => {
      const { root, onChange } = await setup({ min: 0, max: 100, value: 50 });

      root.dispatchEvent(mouse('mousedown', RECT_LEFT + RECT_WIDTH * 0.25));
      onChange.mockClear();
      window.dispatchEvent(mouse('mousemove', RECT_LEFT + RECT_WIDTH * 0.5));

      expect(onChange).not.toHaveBeenCalled();
    });

    it('stops reporting once the mouse is released', async () => {
      const { root, onChange } = await setup({ min: 0, max: 100, value: 50 });

      root.dispatchEvent(mouse('mousedown', RECT_LEFT + RECT_WIDTH / 2));
      window.dispatchEvent(new MouseEvent('mouseup'));
      window.dispatchEvent(mouse('mousemove', RECT_LEFT + RECT_WIDTH * 0.75));

      expect(onChange).not.toHaveBeenCalled();
    });

    it('starts a drag from the thumb without jumping the value', async () => {
      const { thumb, onChange } = await setup({ min: 0, max: 100, value: 50 });

      thumb.dispatchEvent(new MouseEvent('mousedown', { clientX: 0 }));
      expect(onChange).not.toHaveBeenCalled();

      window.dispatchEvent(mouse('mousemove', RECT_LEFT + RECT_WIDTH * 0.75));
      expect(onChange).toHaveBeenCalledWith(75);
    });
  });
});
