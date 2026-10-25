import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import type { RxStore } from '@/engine/rx-store';
import type { Unsubscribe } from '@/internal-types';

/**
 * Hands the store the size of the element the read-only view fills as its
 * viewport, on every resize, and dispatches nothing for a size it already holds.
 * The editor's viewportLayout.ts makes room for the Explorer, which this never reaches.
 */
export function measureViewport(store: RxStore, target: Element): Unsubscribe {
  const observer = new ResizeObserver(entries => {
    for (const { contentRect } of entries) {
      const { width, height } = contentRect;
      const { viewport } = store.state.editor;
      if (viewport.width === width && viewport.height === height) continue;

      store.dispatchSync(changeViewportAction({ width, height }));
    }
  });

  observer.observe(target);

  return () => observer.disconnect();
}
