import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import SharedMouseCursor from '@/components/erd/canvas/shared-mouse-tracker/shared-mouse-cursor/SharedMouseCursor';
import * as styles from '@/components/erd/canvas/shared-mouse-tracker/shared-mouse-cursor/SharedMouseCursor.styles';
import type { SharedMouseTracker } from '@/engine/modules/editor/state';
import { SharedColors, toSharedColor } from '@/utils/sharedColor';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const createTracker = (
  value?: Partial<SharedMouseTracker>
): SharedMouseTracker => ({
  id: 'remote',
  x: 0,
  y: 0,
  nickname: 'dineug',
  timeoutId: null,
  ...value,
});

const cursorOf = () =>
  mounted!.container.querySelector<HTMLElement>(`.${String(styles.cursor)}`)!;

const toHex = (value: string) => {
  if (!value.startsWith('rgb')) return value;

  const channels = value.match(/\d+/g) ?? [];
  return `#${channels
    .slice(0, 3)
    .map(channel => Number(channel).toString(16).padStart(2, '0'))
    .join('')}`;
};

const nextFrame = () =>
  new Promise<void>(resolve => {
    requestAnimationFrame(() => resolve());
  });

const waitFrames = async (count: number) => {
  for (let i = 0; i < count; i++) {
    await nextFrame();
  }
  await flush();
};

describe('SharedMouseCursor', () => {
  it('renders the pointer icon and the nickname at the tracker position', async () => {
    mounted = await mountAndFlush(
      html`<${SharedMouseCursor}
        tracker=${createTracker({ x: 120, y: 240, nickname: 'ada' })}
      />`
    );

    const el = cursorOf();
    expect(el).toBeTruthy();
    expect(el.style.left).toBe('120px');
    expect(el.style.top).toBe('240px');
    expect(el.querySelector('.icon')).toBeTruthy();
    expect(el.querySelector('span')?.textContent).toBe('ada');
  });

  it('eases the rendered position toward the tracker on every animation frame', async () => {
    const tracker = createTracker({ x: 0, y: 0 });
    mounted = await mountAndFlush(
      html`<${SharedMouseCursor} tracker=${tracker} />`
    );

    expect(cursorOf().style.left).toBe('0px');

    tracker.x = 400;
    tracker.y = 800;
    await waitFrames(3);

    const left = Number.parseFloat(cursorOf().style.left);
    const top = Number.parseFloat(cursorOf().style.top);
    expect(left).toBeGreaterThan(0);
    expect(left).toBeLessThan(400);
    expect(top).toBeGreaterThan(0);
    expect(top).toBeLessThan(800);
    expect(top / left).toBeCloseTo(2, 5);
  });

  it('keeps easing closer to the target across successive frames', async () => {
    const tracker = createTracker({ x: 0, y: 0 });
    mounted = await mountAndFlush(
      html`<${SharedMouseCursor} tracker=${tracker} />`
    );

    tracker.x = 1000;
    await waitFrames(2);
    const first = Number.parseFloat(cursorOf().style.left);

    await waitFrames(3);
    const second = Number.parseFloat(cursorOf().style.left);

    expect(second).toBeGreaterThan(first);
    expect(second).toBeLessThan(1000);
  });

  it('re-renders the nickname when the tracker gets a new one', async () => {
    const tracker = createTracker({ nickname: 'user' });
    mounted = await mountAndFlush(
      html`<${SharedMouseCursor} tracker=${tracker} />`
    );

    expect(cursorOf().querySelector('span')?.textContent).toBe('user');

    tracker.nickname = 'renamed';
    tracker.x = 10;
    await waitFrames(2);

    expect(cursorOf().querySelector('span')?.textContent).toBe('renamed');
  });

  it('paints itself in the color that identifies its editor', async () => {
    mounted = await mountAndFlush(
      html`<${SharedMouseCursor}
        tracker=${createTracker({ id: 'remote-1' })}
      />`
    );

    const el = cursorOf();
    expect(el.style.color).toBeTruthy();
    expect(SharedColors).toContain(toHex(el.style.color));
    expect(toHex(el.style.color)).toBe(toSharedColor('remote-1'));
  });

  it('carries that color into the pointer outline', async () => {
    mounted = await mountAndFlush(
      html`<${SharedMouseCursor}
        tracker=${createTracker({ id: 'remote-2' })}
      />`
    );

    const el = cursorOf();
    const svg = el.querySelector('svg') as SVGSVGElement;
    const outline = Array.from(svg.children);

    expect(outline.length).toBeGreaterThan(0);
    expect(svg.getAttribute('fill')).toBe('none');
    expect(svg.getAttribute('stroke')).toBe('currentColor');

    for (const child of outline) {
      expect(child.getAttribute('fill')).toBe('none');
      expect(child.getAttribute('stroke')).toBe('currentColor');
      expect(toHex(getComputedStyle(child).color)).toBe(
        toSharedColor('remote-2')
      );
    }
  });

  it('stops following the tracker once unmounted', async () => {
    const tracker = createTracker({ x: 0, y: 0 });
    mounted = await mountAndFlush(
      html`<${SharedMouseCursor} tracker=${tracker} />`
    );

    mounted.unmount();
    const container = mounted.container;
    mounted = null;

    tracker.x = 500;
    await waitFrames(3);

    expect(container.querySelector(`.${String(styles.cursor)}`)).toBeNull();
  });
});
