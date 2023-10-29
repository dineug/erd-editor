import { createRef, FC, html, observable, ref } from '@dineug/r-html';

import { useAppContext } from '@/components/context';
import Canvas from '@/components/erd/canvas/Canvas';
import DragSelect from '@/components/erd/drag-select/DragSelect';
import ErdContextMenu, {
  ErdContextMenuType,
} from '@/components/erd/erd-context-menu/ErdContextMenu';
import { useContextMenuRootProvider } from '@/components/primitives/context-menu/context-menu-root/contextMenuRootContext';
import { unselectAllAction$ } from '@/engine/modules/editor/generator.actions';
import {
  streamScrollToAction,
  streamZoomLevelAction,
} from '@/engine/modules/settings/atom.actions';
import { drag$, DragMove } from '@/utils/globalEventObservable';
import { isMod } from '@/utils/keyboard-shortcut';

import * as styles from './Erd.styles';
import { useErdShortcut } from './useErdShortcut';

export type ErdProps = {};

const Erd: FC<ErdProps> = (props, ctx) => {
  const contextMenu = useContextMenuRootProvider(ctx);
  const root = createRef<HTMLDivElement>();
  const app = useAppContext(ctx);
  const state = observable({
    dragSelect: false,
    dragSelectX: 0,
    dragSelectY: 0,
  });
  useErdShortcut(ctx);

  const resetScroll = () => {
    if (root.value.scrollTop === 0 && root.value.scrollLeft === 0) {
      return;
    }
    root.value.scrollTop = 0;
    root.value.scrollLeft = 0;
  };

  const handleContextmenu = (event: MouseEvent) => {
    contextMenu.onContextmenu(event);
  };

  const handleContextmenuClose = () => {
    contextMenu.state.show = false;
  };

  const handleWheel = (event: WheelEvent) => {
    const { store } = app.value;
    store.dispatch(
      streamZoomLevelAction({ value: event.deltaY < 0 ? 0.1 : -0.1 })
    );
  };

  const handleMove = ({ event, movementX, movementY }: DragMove) => {
    const { store } = app.value;
    event.type === 'mousemove' && event.preventDefault();
    store.dispatch(streamScrollToAction({ movementX, movementY }));
    resetScroll();
  };

  const handleDragSelect = (event: DragEvent) => {
    const el = event.target as HTMLElement | null;
    if (!el) return;

    const canDrag = !el.closest('.table') && !el.closest('.memo');
    if (!canDrag) return;

    const { store } = app.value;
    store.dispatch(unselectAllAction$());

    if (event.type === 'mousedown' && isMod(event)) {
      const { x, y } = root.value.getBoundingClientRect();
      state.dragSelect = true;
      state.dragSelectX = event.clientX - x;
      state.dragSelectY = event.clientY - y;
    } else {
      drag$.subscribe(handleMove);
    }
  };

  const handleDragSelectEnd = () => {
    state.dragSelect = false;
  };

  return () =>
    html`
      <div
        class=${styles.root}
        ${ref(root)}
        @contextmenu=${handleContextmenu}
        @mousedown=${contextMenu.onMousedown}
        @mousedown=${handleDragSelect}
        @touchstart=${handleDragSelect}
        @wheel=${handleWheel}
      >
        <${Canvas} />
        ${state.dragSelect
          ? html`
              <${DragSelect}
                root=${root}
                x=${state.dragSelectX}
                y=${state.dragSelectY}
                .onDragSelectEnd=${handleDragSelectEnd}
              />
            `
          : null}
        <${ErdContextMenu}
          type=${ErdContextMenuType.ERD}
          root=${root}
          .onClose=${handleContextmenuClose}
        />
      </div>
    `;
};

export default Erd;
