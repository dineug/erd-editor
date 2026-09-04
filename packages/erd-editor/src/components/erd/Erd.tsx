import {
  createRef,
  FC,
  observable,
  onMounted,
  ref,
  watch,
} from '@dineug/r-html';
import { filter, fromEvent, Subscription, throttleTime } from 'rxjs';

import { useAppContext } from '@/components/appContext';
import AutomaticTablePlacement, {
  TablePoint,
} from '@/components/erd/automatic-table-placement/AutomaticTablePlacement';
import Canvas from '@/components/erd/canvas/Canvas';
import DiffViewer from '@/components/erd/diff-viewer/DiffViewer';
import ErdContextMenu, {
  ErdContextMenuType,
} from '@/components/erd/erd-context-menu/ErdContextMenu';
import HideSign from '@/components/erd/hide-sign/HideSign';
import { sceneHit } from '@/components/erd/hitTest';
import Minimap from '@/components/erd/minimap/Minimap';
import TableProperties from '@/components/erd/table-properties/TableProperties';
import TimeTravel from '@/components/erd/time-travel/TimeTravel';
import VirtualScroll from '@/components/erd/virtual-scroll/VirtualScroll';
import ColorPicker from '@/components/primitives/color-picker/ColorPicker';
import { useContextMenuRootProvider } from '@/components/primitives/context-menu/context-menu-root/contextMenuRootContext';
import { Open } from '@/constants/open';
import { CanvasType } from '@/constants/schema';
import {
  changeOpenMapAction,
  sharedMouseTrackerAction,
} from '@/engine/modules/editor/atom.actions';
import {
  changeColorAllAction$,
  unselectAllAction$,
} from '@/engine/modules/editor/generator.actions';
import { Viewport } from '@/engine/modules/editor/state';
import { streamScrollToAction } from '@/engine/modules/settings/atom.actions';
import { streamZoomLevelAction$ } from '@/engine/modules/settings/generator.actions';
import { moveToTableAction } from '@/engine/modules/table/atom.actions';
import { HISTORY_LIMIT } from '@/engine/rx-store';
import { useUnmounted } from '@/hooks/useUnmounted';
import { isMouseEvent } from '@/utils/domEvent';
import { getAbsolutePoint } from '@/utils/dragSelect';
import { closeColorPickerAction, dragSelectStartAction } from '@/utils/emitter';
import { drag$, DragMove, keyup$ } from '@/utils/globalEventObservable';
import { getRelationshipIcon } from '@/utils/icon';
import { isMod } from '@/utils/keyboard-shortcut';

import * as styles from './Erd.styles';
import { useErdShortcut } from './useErdShortcut';

export type ErdProps = {
  isDarkMode: boolean;
  mouseTracking: boolean;
};

const Erd: FC<ErdProps> = (props, ctx) => {
  const contextMenu = useContextMenuRootProvider(ctx);
  const root = createRef<HTMLDivElement>();
  const canvas = createRef<HTMLDivElement>();
  const app = useAppContext(ctx);
  const state = observable({
    contextMenuType: ErdContextMenuType.ERD as ErdContextMenuType,
    relationshipId: '' as string | undefined,
    tableId: '' as string | undefined,
    colorPickerShow: false,
    colorPickerX: 0,
    colorPickerY: 0,
    colorPickerViewport: null as Viewport | null,
    colorPickerInitialColor: '',
    tablePropertiesId: '',
    tablePropertiesIds: [] as string[],
    grabMove: false,
    grabCursor: 'grab',
    diffValue: '{}',
  });
  useErdShortcut(ctx);

  const { addUnsubscribe } = useUnmounted();

  const resetScroll = () => {
    // Defensive: the drag subscription outlives the render part, so root can
    // already be cleared by ref's destroy when a move arrives.
    const $root = root.value;
    if (!$root) return;

    if ($root.scrollTop === 0 && $root.scrollLeft === 0) {
      return;
    }
    $root.scrollTop = 0;
    $root.scrollLeft = 0;
  };

  const getShowOverLayout = () => {
    const { store } = app.value;
    const { editor } = store.state;
    const showAutomaticTablePlacement =
      editor.openMap[Open.automaticTablePlacement];
    const showTableProperties = editor.openMap[Open.tableProperties];
    const showTimeTravel = editor.openMap[Open.timeTravel];
    const showDiffViewer = editor.openMap[Open.diffViewer];

    return (
      showAutomaticTablePlacement ||
      showTableProperties ||
      showTimeTravel ||
      showDiffViewer
    );
  };

  const handleContextmenu = (event: MouseEvent) => {
    if (!event.target || getShowOverLayout()) return;

    const hit = sceneHit(canvas.value, event);

    if (hit?.kind === 'table') {
      state.tableId = hit.id;
      state.contextMenuType = ErdContextMenuType.table;
    } else if (hit?.kind === 'relationship') {
      state.relationshipId = hit.id;
      state.contextMenuType = ErdContextMenuType.relationship;
    } else {
      state.contextMenuType = ErdContextMenuType.ERD;
    }

    contextMenu.onContextmenu(event);
  };

  const handleContextmenuClose = () => {
    contextMenu.state.show = false;
  };

  const handleDiffViewerClose = () => {
    const { store } = app.value;
    store.dispatch(changeOpenMapAction({ [Open.diffViewer]: false }));
    state.diffValue = '{}';
  };

  const handleTimeTravelClose = () => {
    const { store } = app.value;
    store.dispatch(changeOpenMapAction({ [Open.timeTravel]: false }));
  };

  const handleWheel = (event: WheelEvent) => {
    if (getShowOverLayout()) return;
    event.preventDefault();

    const $mod = isMod(event);
    const { store } = app.value;
    const isReverse =
      event.shiftKey && event.deltaX === 0 && event.deltaY !== 0;

    store.dispatch(
      $mod
        ? streamZoomLevelAction$(event.deltaY < 0 ? 0.03 : -0.03)
        : streamScrollToAction(
            isReverse
              ? {
                  movementX: event.deltaY * -1,
                  movementY: event.deltaX * -1,
                }
              : {
                  movementX: event.deltaX * -1,
                  movementY: event.deltaY * -1,
                }
          )
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

    const showOverLayout = getShowOverLayout();
    const canHideColorPicker = !el.closest('.color-picker');
    const hit = sceneHit(canvas.value, event);
    const onEntity = hit?.kind === 'table' || hit?.kind === 'memo';

    // The editing surface sits beside the stage container rather than inside
    // it, so sceneHit cannot see it and the entity it is open over cannot
    // answer for it. The dom scene had the editor inside .table and .memo.
    const onEditor = Boolean(el.closest('.edit-overlay'));

    const canUnselectAll =
      !onEntity &&
      !onEditor &&
      !el.closest('.edit-input') &&
      !el.closest('.context-menu-content') &&
      !el.closest('.hide-sign') &&
      canHideColorPicker;

    const canDrag =
      canUnselectAll &&
      canHideColorPicker &&
      !el.closest('.minimap') &&
      !el.closest('.minimap-viewport') &&
      !el.closest('.virtual-scroll') &&
      !showOverLayout;

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
      event.preventDefault();
      const { emitter } = app.value;
      const { x, y } = root.value.getBoundingClientRect();
      emitter.emit(
        dragSelectStartAction({
          x: event.clientX - x,
          y: event.clientY - y,
        })
      );
    } else {
      if (state.grabMove) {
        state.grabCursor = 'grabbing';
      }

      drag$.subscribe({
        next: handleMove,
        complete: () => {
          state.grabCursor = 'grab';
        },
      });
    }
  };

  const handleChangeColorPicker = (color: string) => {
    const { store } = app.value;
    store.dispatch(changeColorAllAction$(color));
  };

  const handleChangeAutomaticTablePlacement = (tables: TablePoint[]) => {
    const { store } = app.value;
    store.dispatch(tables.map(moveToTableAction));
  };

  const handleChangeTableProperties = (tableId: string) => {
    state.tablePropertiesId = tableId;
  };

  const handleChangeTimeTravel = (cursor: number) => {
    const { store } = app.value;
    const { history } = store;

    let count = 0;

    while (history.cursor !== cursor && count <= HISTORY_LIMIT) {
      history.cursor < cursor ? history.redo() : history.undo();
      count++;
    }
  };

  let mouseTrackerSubscription: Subscription | null = null;

  const handleMouseTrackerEnd = () => {
    mouseTrackerSubscription?.unsubscribe();
    mouseTrackerSubscription = null;
  };

  const handleMouseTrackerStart = () => {
    const { store } = app.value;
    const $root = root.value;
    if (!$root) return;

    handleMouseTrackerEnd();
    mouseTrackerSubscription = fromEvent<MouseEvent>($root, 'mousemove')
      .pipe(
        throttleTime(100, undefined, {
          leading: false,
          trailing: true,
        })
      )
      .subscribe(event => {
        const rect = $root.getBoundingClientRect();
        const {
          settings: { scrollLeft, scrollTop, width, height, zoomLevel },
        } = store.state;
        const x = event.clientX - rect.x - scrollLeft;
        const y = event.clientY - rect.y - scrollTop;
        const absolutePoint = getAbsolutePoint(
          { x, y },
          width,
          height,
          zoomLevel
        );

        store.dispatch(sharedMouseTrackerAction(absolutePoint));
      });
  };

  onMounted(() => {
    const { store, emitter, keydown$ } = app.value;
    const $root = root.value;

    if (props.mouseTracking) {
      handleMouseTrackerStart();
    }

    addUnsubscribe(
      watch(props).subscribe(propName => {
        if (propName !== 'mouseTracking') return;

        props.mouseTracking
          ? handleMouseTrackerStart()
          : handleMouseTrackerEnd();
      }),
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
        openTableProperties: ({ payload: { tableId } }) => {
          const { doc } = store.state;
          const tablePropertiesIds = state.tablePropertiesIds.filter(id =>
            doc.tableIds.includes(id)
          );

          if (tablePropertiesIds.includes(tableId)) {
            const index = tablePropertiesIds.indexOf(tableId);
            tablePropertiesIds.splice(index, 1);
          }

          tablePropertiesIds.unshift(tableId);
          state.tablePropertiesIds = tablePropertiesIds.slice(0, 5);
          state.tablePropertiesId = tableId;
        },
        openDiffViewer: ({ payload: { value } }) => {
          state.diffValue = value;
          store.dispatch(changeOpenMapAction({ [Open.diffViewer]: true }));
        },
      }),
      keydown$
        .pipe(
          filter(event => {
            const el = event.target as HTMLElement | null;
            if (!el) return false;

            const { editor, settings } = store.state;
            const showAutomaticTablePlacement =
              editor.openMap[Open.automaticTablePlacement];
            const showTableProperties = editor.openMap[Open.tableProperties];
            const showTimeTravel = editor.openMap[Open.timeTravel];
            const showDiffViewer = editor.openMap[Open.diffViewer];
            const isCanvasType = settings.canvasType === CanvasType.ERD;

            const canGrabMove =
              isCanvasType &&
              !showAutomaticTablePlacement &&
              !showTableProperties &&
              !showDiffViewer &&
              !showTimeTravel;

            if (!canGrabMove) return false;

            return event.code === 'Space' && el.tagName === 'DIV';
          })
        )
        .subscribe(() => {
          state.grabMove = true;
        }),
      keyup$.pipe(filter(event => event.code === 'Space')).subscribe(() => {
        state.grabMove = false;
      })
    );
  });

  return () => {
    const { store } = app.value;
    const {
      editor: { drawRelationship, openMap },
    } = store.state;

    const showAutomaticTablePlacement = openMap[Open.automaticTablePlacement];
    const showTableProperties = openMap[Open.tableProperties];
    const showTimeTravel = openMap[Open.timeTravel];
    const showDiffViewer = openMap[Open.diffViewer];

    const cursor = state.grabMove
      ? state.grabCursor
      : drawRelationship
        ? `url("${getRelationshipIcon(
            drawRelationship.relationshipType,
            props.isDarkMode
          )}") 16 16, auto`
        : '';

    return (
      <div
        class={styles.root}
        style={{ cursor }}
        use:ref={ref(root)}
        on:contextmenu={handleContextmenu}
        on:mousedown={contextMenu.onMousedown}
        on:mousedown__2={handleDragSelect}
        on:touchstart={handleDragSelect}
        on:wheel={handleWheel}
      >
        <Canvas root={root} canvas={canvas} grabMove={state.grabMove} />
        <VirtualScroll />
        <Minimap />
        <HideSign root={root} />
        {contextMenu.state.show ? (
          <ErdContextMenu
            type={state.contextMenuType}
            relationshipId={state.relationshipId}
            tableId={state.tableId}
            onClose={handleContextmenuClose}
          />
        ) : null}
        {state.colorPickerShow ? (
          <ColorPicker
            color={state.colorPickerInitialColor}
            x={state.colorPickerX}
            y={state.colorPickerY}
            viewport={state.colorPickerViewport}
            onChange={handleChangeColorPicker}
          />
        ) : null}
        {showAutomaticTablePlacement ? (
          <div>
            <AutomaticTablePlacement
              app={app}
              onChange={handleChangeAutomaticTablePlacement}
            />
          </div>
        ) : null}
        {showTableProperties ? (
          <TableProperties
            tableId={state.tablePropertiesId}
            tableIds={state.tablePropertiesIds}
            isDarkMode={props.isDarkMode}
            onChange={handleChangeTableProperties}
          />
        ) : null}
        {showDiffViewer ? (
          <div>
            <DiffViewer
              app={app}
              initialValue={state.diffValue}
              onClose={handleDiffViewerClose}
            />
          </div>
        ) : null}
        {showTimeTravel ? (
          <div>
            <TimeTravel
              app={app}
              onChange={handleChangeTimeTravel}
              onClose={handleTimeTravelClose}
            />
          </div>
        ) : null}
      </div>
    );
  };
};

export default Erd;
