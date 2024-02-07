import {
  createRef,
  FC,
  html,
  observable,
  ref,
  useProvider,
} from '@dineug/r-html';

import { AppContext, appContext } from '@/components/appContext';
import Canvas from '@/components/erd/canvas/Canvas';
import Minimap from '@/components/erd/minimap/Minimap';
import VirtualScroll from '@/components/erd/virtual-scroll/VirtualScroll';
import { unselectAllAction$ } from '@/engine/modules/editor/generator.actions';
import { streamScrollToAction } from '@/engine/modules/settings/atom.actions';
import { streamZoomLevelAction$ } from '@/engine/modules/settings/generator.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import { onPrevent } from '@/utils/domEvent';
import { closeColorPickerAction } from '@/utils/emitter';
import { drag$, DragMove } from '@/utils/globalEventObservable';
import { isMod } from '@/utils/keyboard-shortcut';

import * as styles from './ErdViewer.styles';

export type ErdViewerProps = {
  app: AppContext;
};

const ErdViewer: FC<ErdViewerProps> = (props, ctx) => {
  const root = createRef<HTMLDivElement>();
  const canvas = createRef<HTMLDivElement>();
  const app = props.app;
  const provider = useProvider(ctx, appContext, app);
  const state = observable({
    grabCursor: 'grab',
  });
  const { addUnsubscribe } = useUnmounted();

  addUnsubscribe(() => {
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

    const canUnselectAll =
      !el.closest('.table') &&
      !el.closest('.memo') &&
      !el.closest('.edit-input') &&
      !el.closest('.context-menu-content') &&
      !el.closest('.hide-sign') &&
      canHideColorPicker;

    const canDrag =
      canUnselectAll &&
      canHideColorPicker &&
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

  return () => html`
    <div
      class=${styles.root}
      style=${{ cursor: state.grabCursor }}
      ${ref(root)}
      @contextmenu=${onPrevent}
      @mousedown=${handleDragSelect}
      @touchstart=${handleDragSelect}
      @wheel=${handleWheel}
    >
      <${Canvas} root=${root} canvas=${canvas} grabMove=${true} />
      <${VirtualScroll} />
      <${Minimap} />
    </div>
  `;
};

export default ErdViewer;
