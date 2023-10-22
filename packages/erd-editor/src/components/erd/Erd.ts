import { createRef, FC, html, ref } from '@dineug/r-html';

import { useAppContext } from '@/components/context';
import Canvas from '@/components/erd/canvas/Canvas';
import ErdContextMenu, {
  ErdContextMenuType,
} from '@/components/erd/erd-context-menu/ErdContextMenu';
import { useContextMenuRootProvider } from '@/components/primitives/context-menu/context-menu-root/contextMenuRootContext';
import { unselectAllAction } from '@/engine/modules/editor/atom.actions';
import {
  streamScrollToAction,
  streamZoomLevelAction,
} from '@/engine/modules/settings/atom.actions';
import { drag$, DragMove } from '@/utils/globalEventObservable';

import * as styles from './Erd.styles';
import { useErdShortcut } from './useErdShortcut';

export type ErdProps = {};

const Erd: FC<ErdProps> = (props, ctx) => {
  const contextMenu = useContextMenuRootProvider(ctx);
  const root = createRef<HTMLDivElement>();
  const app = useAppContext(ctx);
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
    store.dispatch(unselectAllAction());

    // TODO: dragSelect
    drag$.subscribe(handleMove);
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
        ${contextMenu.state.show
          ? html`
              <${ErdContextMenu}
                type=${ErdContextMenuType.ERD}
                root=${root}
                .onClose=${handleContextmenuClose}
              />
            `
          : null}
      </div>
    `;
};

export default Erd;
