/** @jsxHost konva */

// The other edge of the same module-scope read: an icon lucide does carry,
// whose path node holds no d attribute. The nullish fallback is what keeps
// that path data a string rather than the literal undefined konva would warn on.

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
      name === 'mouse-pointer-2'
        ? { name, node: [['path', {}]] }
        : actual.getIcon(name),
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

describe('the pointer outline when lucide leaves a path with no d attribute', () => {
  it('draws that path with empty data instead of the literal undefined', async () => {
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

    const paths = stage.find<Path>('.shared-mouse-cursor-pointer');
    expect(paths).toHaveLength(1);
    expect(paths[0].data()).toBe('');
  });
});
