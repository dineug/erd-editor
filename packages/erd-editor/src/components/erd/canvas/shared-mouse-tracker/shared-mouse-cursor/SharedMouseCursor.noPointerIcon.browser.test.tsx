/** @jsxHost konva */

// The pointer outline SharedMouseCursor draws is read once at import, off
// whatever lucide hands back for its icon name. Mocked here so that lookup
// carries none at all, which the real icon set never leaves reachable.

import type { Group } from 'konva/lib/Group';
import type { Path } from 'konva/lib/shapes/Path';
import type { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createTestAppContext, flush } from '@/__test-utils__';
import SharedMouseCursor from '@/components/erd/canvas/shared-mouse-tracker/shared-mouse-cursor/SharedMouseCursor';
import type { SharedMouseTracker } from '@/engine/modules/editor/state';
import { whenDrawn } from '@/konva/batchDraw';
import { renderScene } from '@/konva/scene/renderScene';

vi.mock('@/components/primitives/icon/icons', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@/components/primitives/icon/icons')>();

  return {
    ...actual,
    getIcon: (name: string) =>
      name === 'mouse-pointer-2' ? undefined : actual.getIcon(name),
  };
});

const tracker: SharedMouseTracker = {
  id: 'remote',
  x: 0,
  y: 0,
  nickname: 'dineug',
  timeoutId: null,
};

let stage: Stage | null = null;
let destroy: (() => void) | null = null;

afterEach(async () => {
  destroy?.();
  destroy = null;
  stage = null;
  await whenDrawn();
});

describe('the pointer outline when lucide carries no mouse-pointer-2 icon', () => {
  it('mounts the cursor with its nickname but draws no pointer path', async () => {
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

    expect(stage.findOne<Group>('.shared-mouse-cursor')).toBeTruthy();
    expect(stage.find<Path>('.shared-mouse-cursor-pointer')).toHaveLength(0);
  });
});
