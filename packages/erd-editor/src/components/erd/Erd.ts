import { createRef, FC, html, observable, ref } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import Canvas from '@/components/erd/canvas/Canvas';
import DragSelect from '@/components/erd/drag-select/DragSelect';
import ErdContextMenu, {
  ErdContextMenuType,
} from '@/components/erd/erd-context-menu/ErdContextMenu';
import Minimap from '@/components/erd/minimap/Minimap';
import { useContextMenuRootProvider } from '@/components/primitives/context-menu/context-menu-root/contextMenuRootContext';
import { unselectAllAction$ } from '@/engine/modules/editor/generator.actions';
import {
  streamScrollToAction,
  streamZoomLevelAction,
} from '@/engine/modules/settings/atom.actions';
import { isMouseEvent } from '@/utils/domEvent';
import { drag$, DragMove } from '@/utils/globalEventObservable';
import { getRelationshipIcon } from '@/utils/icon';
import { isMod } from '@/utils/keyboard-shortcut';

import * as styles from './Erd.styles';
import { useErdShortcut } from './useErdShortcut';

export type ErdProps = {};

const Erd: FC<ErdProps> = (props, ctx) => {
  const contextMenu = useContextMenuRootProvider(ctx);
  const root = createRef<HTMLDivElement>();
  const canvas = createRef<HTMLDivElement>();
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
    if (movementX === 0 && movementY === 0) {
      return;
    }
    store.dispatch(streamScrollToAction({ movementX, movementY }));
    resetScroll();
  };

  const handleDragSelect = (event: MouseEvent | TouchEvent) => {
    const el = event.target as HTMLElement | null;
    if (!el) return;

    const canUnselectAll =
      !el.closest('.table') &&
      !el.closest('.memo') &&
      !el.closest('.edit-input');

    const canDrag =
      canUnselectAll &&
      !el.closest('.minimap') &&
      !el.closest('.minimap-viewport');

    if (canUnselectAll) {
      const { store } = app.value;
      store.dispatch(unselectAllAction$());
    }

    if (!canDrag) return;

    if (isMouseEvent(event) && isMod(event)) {
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

  return () => {
    const { store } = app.value;
    const {
      editor: { drawRelationship },
    } = store.state;

    const cursor = drawRelationship
      ? `url("${getRelationshipIcon(
          drawRelationship.relationshipType
        )}") 16 16, auto`
      : '';

    return html`
      <div
        class=${styles.root}
        style=${{ cursor }}
        ${ref(root)}
        @contextmenu=${handleContextmenu}
        @mousedown=${contextMenu.onMousedown}
        @mousedown=${handleDragSelect}
        @touchstart=${handleDragSelect}
        @wheel=${handleWheel}
      >
        <${Canvas} root=${root} canvas=${canvas} />
        <${Minimap} />
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
          root=${canvas}
          .onClose=${handleContextmenuClose}
        />
      </div>
    `;
  };
};

export default Erd;
