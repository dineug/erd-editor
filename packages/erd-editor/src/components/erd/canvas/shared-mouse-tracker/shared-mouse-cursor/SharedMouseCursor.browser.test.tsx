/** @jsxHost konva */

import type { Group } from 'konva/lib/Group';
import type { Path } from 'konva/lib/shapes/Path';
import type { Text } from 'konva/lib/shapes/Text';
import type { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext, flush } from '@/__test-utils__';
import SharedMouseCursor from '@/components/erd/canvas/shared-mouse-tracker/shared-mouse-cursor/SharedMouseCursor';
import type { SharedMouseTracker } from '@/engine/modules/editor/state';
import { whenDrawn } from '@/konva/batchDraw';
import { renderScene } from '@/konva/scene/renderScene';
import { SharedColors, toSharedColor } from '@/utils/sharedColor';

let stage: Stage | null = null;
let destroy: (() => void) | null = null;

afterEach(async () => {
  destroy?.();
  destroy = null;
  stage = null;
  await whenDrawn();
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

async function mountCursor(tracker: SharedMouseTracker) {
  const container = document.createElement('div');
  document.body.append(container);

  const rendered = renderScene({
    app: createTestAppContext(),
    container,
    width: 400,
    height: 300,
    scene: (
      <k-layer name="presence">
        <SharedMouseCursor tracker={tracker} />
      </k-layer>
    ),
  });

  stage = rendered.stage;
  destroy = () => {
    rendered.destroy();
    container.remove();
  };

  await flush();
  await whenDrawn();
}

const cursorOf = () => stage!.findOne<Group>('.shared-mouse-cursor')!;

const pointersOf = () => stage!.find<Path>('.shared-mouse-cursor-pointer');

const nicknameOf = () => stage!.findOne<Text>('.shared-mouse-cursor-nickname')!;

const nextFrame = () =>
  new Promise<void>(resolve => {
    requestAnimationFrame(() => resolve());
  });

const waitFrames = async (count: number) => {
  for (let i = 0; i < count; i++) {
    await nextFrame();
  }
  await flush();
  await whenDrawn();
};

describe('SharedMouseCursor', () => {
  it('renders the pointer outline and the nickname at the tracker position', async () => {
    await mountCursor(createTracker({ x: 120, y: 240, nickname: 'ada' }));

    const cursor = cursorOf();
    expect([cursor.x(), cursor.y()]).toEqual([120, 240]);
    expect(cursor.getAttr('kind')).toBe('shared-mouse-cursor');
    expect(cursor.listening()).toBe(false);
    expect(pointersOf().length).toBeGreaterThan(0);
    expect(pointersOf()[0].data()).toBeTruthy();
    expect(nicknameOf().text()).toBe('ada');
  });

  it('scales the icon down from its own viewBox and puts the name beside it', async () => {
    await mountCursor(createTracker({ nickname: 'ada' }));

    const icon = stage!.findOne<Group>('.shared-mouse-cursor-icon')!;
    const nickname = nicknameOf();

    expect([icon.scaleX(), icon.scaleY()]).toEqual([16 / 24, 16 / 24]);
    expect(nickname.x()).toBe(16);
    expect(nickname.width()).toBe(84);
    expect(nickname.wrap()).toBe('none');
    expect(nickname.ellipsis()).toBe(true);
  });

  it('eases the rendered position toward the tracker on every animation frame', async () => {
    const tracker = createTracker({ x: 0, y: 0 });
    await mountCursor(tracker);

    expect(cursorOf().x()).toBe(0);

    tracker.x = 400;
    tracker.y = 800;
    await waitFrames(3);

    const cursor = cursorOf();
    const x = cursor.x();
    const y = cursor.y();
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(400);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(800);
    expect(y / x).toBeCloseTo(2, 5);
  });

  it('keeps easing closer to the target across successive frames', async () => {
    const tracker = createTracker({ x: 0, y: 0 });
    await mountCursor(tracker);

    tracker.x = 1000;
    await waitFrames(2);
    const first = cursorOf().x();

    await waitFrames(3);
    const second = cursorOf().x();

    expect(second).toBeGreaterThan(first);
    expect(second).toBeLessThan(1000);
  });

  it('re-renders the nickname when the tracker gets a new one', async () => {
    const tracker = createTracker({ nickname: 'user' });
    await mountCursor(tracker);

    expect(nicknameOf().text()).toBe('user');

    tracker.nickname = 'renamed';
    tracker.x = 10;
    await waitFrames(2);

    expect(nicknameOf().text()).toBe('renamed');
  });

  it('paints outline and name in the color that identifies its editor', async () => {
    await mountCursor(createTracker({ id: 'remote-1' }));

    const color = toSharedColor('remote-1');
    expect(SharedColors).toContain(color);
    expect(nicknameOf().fill()).toBe(color);

    for (const pointer of pointersOf()) {
      expect(pointer.stroke()).toBe(color);
      expect(pointer.fill()).toBeUndefined();
    }
  });

  it('stops following the tracker once unmounted', async () => {
    const tracker = createTracker({ x: 0, y: 0 });
    await mountCursor(tracker);
    const mountedStage = stage!;

    destroy?.();
    destroy = null;

    tracker.x = 500;
    await waitFrames(3);

    expect(mountedStage.findOne('.shared-mouse-cursor')).toBeUndefined();
  });
});
