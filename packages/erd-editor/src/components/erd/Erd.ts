import {
  createRef,
  FC,
  html,
  observable,
  onMounted,
  ref,
} from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import AutomaticTablePlacement, {
  TablePoint,
} from '@/components/erd/automatic-table-placement/AutomaticTablePlacement';
import Canvas from '@/components/erd/canvas/Canvas';
import DragSelect from '@/components/erd/drag-select/DragSelect';
import ErdContextMenu, {
  ErdContextMenuType,
} from '@/components/erd/erd-context-menu/ErdContextMenu';
import Minimap from '@/components/erd/minimap/Minimap';
import ColorPicker from '@/components/primitives/color-picker/ColorPicker';
import { useContextMenuRootProvider } from '@/components/primitives/context-menu/context-menu-root/contextMenuRootContext';
import {
  changeColorAllAction$,
  unselectAllAction$,
} from '@/engine/modules/editor/generator.actions';
import { Viewport } from '@/engine/modules/editor/state';
import {
  streamScrollToAction,
  streamZoomLevelAction,
} from '@/engine/modules/settings/atom.actions';
import { moveToTableAction } from '@/engine/modules/table/atom.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import { isMouseEvent } from '@/utils/domEvent';
import { closeColorPickerAction } from '@/utils/emitter';
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
    contextMenuType: ErdContextMenuType.ERD as ErdContextMenuType,
    relationshipId: '' as string | undefined,
    tableId: '' as string | undefined,
    colorPickerShow: false,
    colorPickerX: 0,
    colorPickerY: 0,
    colorPickerViewport: null as Viewport | null,
    colorPickerInitialColor: '',
  });
  useErdShortcut(ctx);

  const { addUnsubscribe } = useUnmounted();

  const resetScroll = () => {
    if (root.value.scrollTop === 0 && root.value.scrollLeft === 0) {
      return;
    }
    root.value.scrollTop = 0;
    root.value.scrollLeft = 0;
  };

  const handleContextmenu = (event: MouseEvent) => {
    const el = event.target as HTMLElement | null;
    if (!el) return;

    const $table = el.closest('.table') as HTMLElement | null;
    const $relationship = el.closest('.relationship') as HTMLElement | null;

    if ($table) {
      state.tableId = $table.dataset.id;
      state.contextMenuType = ErdContextMenuType.table;
    } else if ($relationship) {
      state.relationshipId = $relationship.dataset.id;
      state.contextMenuType = ErdContextMenuType.relationship;
    } else {
      state.contextMenuType = ErdContextMenuType.ERD;
    }

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

    const canHideColorPicker = !el.closest('.color-picker');

    const canUnselectAll =
      !el.closest('.table') &&
      !el.closest('.memo') &&
      !el.closest('.edit-input') &&
      !el.closest('.context-menu-content') &&
      canHideColorPicker;

    const canDrag =
      canUnselectAll &&
      canHideColorPicker &&
      !el.closest('.minimap') &&
      !el.closest('.minimap-viewport');

    if (canUnselectAll) {
      const { store } = app.value;
      store.dispatch(unselectAllAction$());
    }

    if (canHideColorPicker) {
      const { emitter } = app.value;
      emitter.emit(closeColorPickerAction());
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

  const handleChangeColorPicker = (color: string) => {
    const { store } = app.value;
    store.dispatch(changeColorAllAction$(color));
  };

  const handleChangeAutomaticTablePlacement = (tables: TablePoint[]) => {
    const { store } = app.value;
    store.dispatch(tables.map(moveToTableAction));
  };

  onMounted(() => {
    const { store, emitter } = app.value;
    const $root = root.value;

    addUnsubscribe(
      emitter.on({
        openColorPicker: ({ payload: { x, y, color } }) => {
          const { editor } = store.state;
          const rect = $root.getBoundingClientRect();

          state.colorPickerX = x - rect.x;
          state.colorPickerY = y - rect.y;
          state.colorPickerViewport = editor.viewport;
          state.colorPickerInitialColor = color;
          state.colorPickerShow = true;
        },
        closeColorPicker: () => {
          state.colorPickerShow = false;
        },
      })
    );
  });

  return () => {
    const { store } = app.value;
    const {
      editor: { drawRelationship, runAutomaticTablePlacement },
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
          type=${state.contextMenuType}
          canvas=${canvas}
          relationshipId=${state.relationshipId}
          tableId=${state.tableId}
          .onClose=${handleContextmenuClose}
        />
        ${state.colorPickerShow
          ? html`
              <${ColorPicker}
                color=${state.colorPickerInitialColor}
                x=${state.colorPickerX}
                y=${state.colorPickerY}
                viewport=${state.colorPickerViewport}
                .onChange=${handleChangeColorPicker}
              />
            `
          : null}
        ${runAutomaticTablePlacement
          ? html`
              <${AutomaticTablePlacement}
                app=${app}
                .onChange=${handleChangeAutomaticTablePlacement}
              />
            `
          : null}
      </div>
    `;
  };
};

export default Erd;
