import { createRef, FC, observable, ref, useProvider } from '@dineug/r-html';

import { AppContext, appContext } from '@/components/appContext';
import Canvas from '@/components/erd/canvas/Canvas';
import ContentCompass from '@/components/erd/content-compass/ContentCompass';
import { Diff, DiffMap } from '@/components/erd/diff-viewer/diff';
import { diffContext } from '@/components/erd/diff-viewer/diffContext';
import { sceneHit } from '@/components/erd/hitTest';
import Minimap from '@/components/erd/minimap/Minimap';
import VirtualScroll from '@/components/erd/virtual-scroll/VirtualScroll';
import { sceneSourceContext } from '@/components/sceneSourceContext';
import { unselectAllAction$ } from '@/engine/modules/editor/generator.actions';
import { streamScrollToAction } from '@/engine/modules/settings/atom.actions';
import { streamZoomLevelAction$ } from '@/engine/modules/settings/generator.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import { getContentRect } from '@/konva/scene/contentBounds';
import { onPrevent } from '@/utils/domEvent';
import { closeColorPickerAction } from '@/utils/emitter';
import { drag$, DragMove } from '@/utils/globalEventObservable';
import { isMod } from '@/utils/keyboard-shortcut';

import * as styles from './ErdViewer.styles';

export type ErdViewerProps = {
  app: AppContext;
  diff: number;
  diffMap: DiffMap;
};

const ErdViewer: FC<ErdViewerProps> = (props, ctx) => {
  const root = createRef<HTMLDivElement>();
  const canvas = createRef<HTMLDivElement>();
  const app = props.app;
  const provider = useProvider(ctx, appContext, app);
  // Each pane is a document of its own, so it names the document source
  // rather than inheriting whatever scene the diff was opened over.
  const sceneSource = useProvider(ctx, sceneSourceContext, 'document');
  // The pane's changes reach the cells the scene draws, which tint by them.
  const diffMap = useProvider(ctx, diffContext, props.diffMap);
  const state = observable({
    grabCursor: 'grab',
  });
  const { addUnsubscribe } = useUnmounted();

  addUnsubscribe(() => {
    diffMap.destroy();
    sceneSource.destroy();
    provider.destroy();
  });

  const resetScroll = () => {
    if (root.value.scrollTop === 0 && root.value.scrollLeft === 0) {
      return;
    }
    root.value.scrollTop = 0;
    root.value.scrollLeft = 0;
  };

  const handleWheel = (event: WheelEvent) => {
    event.preventDefault();

    const $mod = isMod(event);
    const { store } = app;

    store.dispatch(
      $mod
        ? streamZoomLevelAction$(event.deltaY < 0 ? 0.1 : -0.1)
        : streamScrollToAction({
            movementX: event.deltaX * -1,
            movementY: event.deltaY * -1,
          })
    );
  };

  const handleMove = ({ event, movementX, movementY }: DragMove) => {
    const { store } = app;
    event.type === 'mousemove' && event.preventDefault();
    if (movementX === 0 && movementY === 0) {
      return;
    }
    store.dispatch(streamScrollToAction({ movementX, movementY }));
    resetScroll();
  };

  const handleDragSelect = (event: MouseEvent | TouchEvent) => {
    const el = event.target as HTMLElement | null;
    if (!el) return;

    const canHideColorPicker = !el.closest('.color-picker');
    const hit = sceneHit(canvas.value, event);
    const onEntity = hit?.kind === 'table' || hit?.kind === 'memo';

    const canUnselectAll =
      !onEntity &&
      !el.closest('.edit-overlay') &&
      !el.closest('.edit-input') &&
      !el.closest('.context-menu-content') &&
      canHideColorPicker;

    const canDrag =
      canUnselectAll &&
      canHideColorPicker &&
      !el.closest('.content-compass') &&
      !el.closest('.minimap') &&
      !el.closest('.minimap-viewport') &&
      !el.closest('.virtual-scroll');

    if (canUnselectAll) {
      const { store } = app;
      store.dispatch(unselectAllAction$());
    }

    if (canHideColorPicker) {
      const { emitter } = app;
      emitter.emit(closeColorPickerAction());
    }

    if (!canDrag) return;

    state.grabCursor = 'grabbing';

    drag$.subscribe({
      next: handleMove,
      complete: () => {
        state.grabCursor = 'grab';
      },
    });
  };

  return () => {
    // As in Erd: an empty document draws no scrollbar and no map either.
    const hasContent = getContentRect(app.store.state) !== null;

    return (
      <div
        class={[
          styles.root,
          props.diff === Diff.insert
            ? 'diff-viewer-insert'
            : 'diff-viewer-delete',
        ]}
        style={{ cursor: state.grabCursor }}
        use:ref={ref(root)}
        on:contextmenu={onPrevent}
        on:mousedown={handleDragSelect}
        on:touchstart={handleDragSelect}
        on:wheel={handleWheel}
      >
        <Canvas root={root} canvas={canvas} grabMove={true} />
        <VirtualScroll />
        {hasContent ? <Minimap /> : null}
        <ContentCompass />
      </div>
    );
  };
};

export default ErdViewer;
