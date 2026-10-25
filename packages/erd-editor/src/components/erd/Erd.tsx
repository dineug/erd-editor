import {
  createRef,
  FC,
  nextTick,
  observable,
  onMounted,
  type Ref,
  ref,
  useProvider,
  watch,
} from '@dineug/r-html';
import { filter, fromEvent, Subscription, take, throttleTime } from 'rxjs';

import { useAppContext } from '@/components/appContext';
import AutomaticTablePlacement, {
  TablePoint,
} from '@/components/erd/automatic-table-placement/AutomaticTablePlacement';
import { toPlacementActions } from '@/components/erd/automatic-table-placement/placementActions';
import { runElkPlacement } from '@/components/erd/automatic-table-placement/runElkPlacement';
import Canvas from '@/components/erd/canvas/Canvas';
import { editingLayers } from '@/components/erd/canvas/editingLayers';
import EditOverlay from '@/components/erd/canvas/EditOverlay';
import { createViewPress } from '@/components/erd/canvas/readPress';
import DiffViewer from '@/components/erd/diff-viewer/DiffViewer';
import DrawTargetButtons from '@/components/erd/draw-target/DrawTargetButtons';
import ErdContextMenu, {
  ErdContextMenuType,
} from '@/components/erd/erd-context-menu/ErdContextMenu';
import FloatingToolbar from '@/components/erd/floating-toolbar/FloatingToolbar';
import {
  listenSceneHover,
  ownsPress,
  sceneHit,
} from '@/components/erd/hitTest';
import Minimap from '@/components/erd/minimap/Minimap';
import { clearRelationshipHighlight } from '@/components/erd/relationshipHighlight';
import TableGroupDraft from '@/components/erd/table-group/TableGroupDraft';
import { useTableGroupDraw } from '@/components/erd/table-group/useTableGroupDraw';
import TableProperties from '@/components/erd/table-properties/TableProperties';
import TimeTravel from '@/components/erd/time-travel/TimeTravel';
import VirtualScroll from '@/components/erd/virtual-scroll/VirtualScroll';
import { isEmptyDocument } from '@/components/erd/welcome-screen/welcomeLayout';
import WelcomeScreen from '@/components/erd/welcome-screen/WelcomeScreen';
import ColorPicker from '@/components/primitives/color-picker/ColorPicker';
import { useContextMenuRootProvider } from '@/components/primitives/context-menu/context-menu-root/contextMenuRootContext';
import {
  type SceneInteraction,
  sceneInteractionContext,
} from '@/components/sceneInteractionContext';
import { sceneSourceContext } from '@/components/sceneSourceContext';
import { Open } from '@/constants/open';
import { CanvasType } from '@/constants/schema';
import { WHEEL_ZOOM_STEP } from '@/constants/zoom';
import {
  changeDrawTableGroupAction,
  changeOpenMapAction,
  initialLoadJsonAction,
  sharedMouseTrackerAction,
} from '@/engine/modules/editor/atom.actions';
import {
  changeColorAllAction$,
  removeColorAllAction$,
  unselectAllAction$,
} from '@/engine/modules/editor/generator.actions';
import { isEditingText, Viewport } from '@/engine/modules/editor/state';
import { getDocumentColors } from '@/engine/modules/editor/utils/color';
import { streamScrollToAction } from '@/engine/modules/settings/atom.actions';
import { streamZoomLevelAction$ } from '@/engine/modules/settings/generator.actions';
import { selectTableGroupAction$ } from '@/engine/modules/table-group/generator.actions';
import { HISTORY_LIMIT } from '@/engine/rx-store';
import { usePinchZoom } from '@/hooks/usePinchZoom';
import { useUnmounted } from '@/hooks/useUnmounted';
import { hasContent } from '@/konva/scene/contentBounds';
import { getSceneTransform, toScenePoint } from '@/konva/scene/viewport';
import { isElkPlacement } from '@/services/elk-layout';
import {
  editorRootOf,
  isMainButtonPress,
  isMiddleButtonPress,
  isMouseEvent,
  preventMiddleLift,
  suppressSelection,
} from '@/utils/domEvent';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';
import { closeColorPickerAction, dragSelectStartAction } from '@/utils/emitter';
import {
  drag$,
  DragMove,
  keyup$,
  moveEnd$,
} from '@/utils/globalEventObservable';
import { getRelationshipIcon } from '@/utils/icon';
import { isMod, KeyBindingName } from '@/utils/keyboard-shortcut';
import { isTakenOver } from '@/utils/takeover';

import * as styles from './Erd.styles';
import { useErdShortcut } from './useErdShortcut';

export type ErdProps = {
  isDarkMode: boolean;
  mouseTracking: boolean;
  readonly: boolean;
  enableWelcomeScreen?: boolean;
  enableThemeBuilder?: boolean;
  enableLocalePicker?: boolean;
  /** Whether the canvas takes a wheel, a pinch or a touch; true if unset. */
  interactive?: () => boolean;
};

/**
 * The ERD tab is the document's own scene. Said here rather than left to the
 * context default, so a view overlay opened over it cannot hand its source down
 * to this canvas, its map, its scrollbars or its compass.
 */
const SOURCE: GeometrySource = 'document';

/**
 * The chrome a takeover lays over its scene, which keeps its own presses for
 * the middle button as this canvas's does: the diff tree, which scrolls, the
 * time travel slider, and a diff pane's compass, minimap and scrollbars.
 */
const TAKEOVER_CHROME = [
  '.diff-viewer-tree',
  '.time-travel-slider',
  '.content-compass',
  '.minimap',
  '.minimap-viewport',
  '.virtual-scroll',
].join(', ');

const Erd: FC<ErdProps> = (props, ctx) => {
  const contextMenu = useContextMenuRootProvider(ctx);
  const sceneSource = useProvider(ctx, sceneSourceContext, SOURCE);
  const root = createRef<HTMLDivElement>();
  const canvas = createRef<HTMLDivElement>();
  const app = useAppContext(ctx);
  // A getter rather than a value set on each turn, since a scene that mounts
  // after a set still gets the value the provider started with.
  const sceneInteraction = useProvider(
    ctx,
    sceneInteractionContext,
    (): SceneInteraction => (app.value.store.getReadonly() ? 'read' : 'edit')
  );
  const state = observable({
    contextMenuType: ErdContextMenuType.ERD as ErdContextMenuType,
    relationshipId: '' as string | undefined,
    tableId: '' as string | undefined,
    columnId: '' as string | undefined,
    memoId: '' as string | undefined,
    tableGroupId: '' as string | undefined,
    colorPickerShow: false,
    colorPickerX: 0,
    colorPickerY: 0,
    colorPickerViewport: null as Viewport | null,
    colorPickerInitialColor: '',
    colorPickerDocumentColors: [] as string[],
    tablePropertiesId: '',
    tablePropertiesIds: [] as string[],
    grabCursor: 'grab',
    diffValue: '{}',
  });
  useErdShortcut(ctx);

  const { addUnsubscribe } = useUnmounted();
  addUnsubscribe(() => {
    sceneInteraction.destroy();
    sceneSource.destroy();
  });

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
    const { state } = app.value.store;
    return (
      isTakenOver(state) || Boolean(state.editor.openMap[Open.tableProperties])
    );
  };

  const interactive = () => props.interactive?.() ?? true;

  const pinch = usePinchZoom({
    app: () => app.value,
    root,
    enabled: () => !getShowOverLayout(),
    interactive,
  });

  const groupDraw = useTableGroupDraw({ app: () => app.value, root });

  /**
   * The editor root, which a still press focuses and whose text a pan keeps
   * from being selected.
   */
  const editorRoot = {
    get value() {
      return (root.value && editorRootOf(root.value)) as HTMLDivElement;
    },
  } satisfies Ref<HTMLDivElement>;

  // What the pinch made of the press now handled, read by the press rule.
  let pinched = false;

  /**
   * A readonly canvas takes a press by the read-only view's rule. Its root holds
   * every touch (touch-action: none), so a finger pans before the focus too,
   * as it does in an editor, rather than waiting on a page that never scrolls.
   */
  const readPress = createViewPress({
    app: app.value,
    root: editorRoot,
    canvas,
    pinches: () => pinched,
    pansBeforeFocus: true,
  });

  let stopHover: (() => void) | null = null;

  /** Hears the table the pointer rests on, whose relationships it lights, while readonly alone. */
  const listenHover = (readonly: boolean) => {
    stopHover?.();
    stopHover = readonly
      ? listenSceneHover(canvas.value, readPress.handleHover)
      : null;
  };

  addUnsubscribe(() => {
    stopHover?.();
    readPress.destroy();
  });

  /** Whether a press on the canvas draws a table group, which a readonly store never does. */
  const drawsTableGroup = () => {
    const { store } = app.value;
    return store.state.editor.drawTableGroup && !store.getReadonly();
  };

  const cancelTableGroupDraw = () => {
    const { store } = app.value;
    if (store.state.editor.drawTableGroup) {
      store.dispatch(changeDrawTableGroupAction({ value: false }));
    }
  };

  /**
   * The scene's own part of a readonly turn, the element ending the store's
   * edit state: the hover follows the press rule, what it lit goes out either
   * way, and readonly ends a table group draw.
   */
  const handleReadonlyTurn = () => {
    listenHover(props.readonly);
    readPress.reset();
    if (props.readonly) cancelTableGroupDraw();
  };

  // The press that ends the draw mode for another button is spent on that, so
  // the menu it raises stays unshown, as does one a Mac Ctrl+click raises.
  let swallowContextmenu = false;

  const handleContextmenu = (event: MouseEvent) => {
    if (swallowContextmenu || drawsTableGroup()) {
      swallowContextmenu = false;
      event.preventDefault();
      return;
    }
    if (!event.target || getShowOverLayout()) return;

    const hit = sceneHit(canvas.value, event);

    // A readonly reader has nothing to do on a relationship, a memo or a
    // group, so none raises a menu, and no group is selected for one.
    if (props.readonly && hit && hit.kind !== 'table') {
      event.preventDefault();
      return;
    }

    if (hit?.kind === 'table') {
      state.tableId = hit.id;
      state.columnId = hit.columnId;
      state.contextMenuType = ErdContextMenuType.table;
    } else if (hit?.kind === 'memo') {
      state.memoId = hit.id;
      state.contextMenuType = ErdContextMenuType.memo;
    } else if (hit?.kind === 'relationship') {
      state.relationshipId = hit.id;
      state.contextMenuType = ErdContextMenuType.relationship;
    } else if (hit?.kind === 'tableGroup') {
      // A Mac Ctrl+click and a long touch are main presses, which read the
      // body as canvas and unselect, so the menu they raise selects the group
      // as a right press would have; one the selection holds stays as it is.
      const { store } = app.value;
      if (!store.state.editor.selectedMap[hit.id]) {
        store.dispatch(selectTableGroupAction$(hit.id, false));
      }
      state.tableGroupId = hit.id;
      state.contextMenuType = ErdContextMenuType.tableGroup;
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
    if (pinch.handleWheel(event) || !interactive() || getShowOverLayout()) {
      return;
    }
    event.preventDefault();

    const $mod = isMod(event);
    const { store } = app.value;
    const isReverse =
      event.shiftKey && event.deltaX === 0 && event.deltaY !== 0;

    store.dispatch(
      $mod
        ? streamZoomLevelAction$(
            event.deltaY < 0 ? WHEEL_ZOOM_STEP : -WHEEL_ZOOM_STEP
          )
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

  /**
   * A readonly press pans or lights by the read-only view's rule, except under a
   * takeover or Table Properties. It still pinches, closes the colour picker and
   * holds a takeover's middle press with its lift, as an edit press does.
   */
  const handleReadPress = (event: MouseEvent | TouchEvent, el: HTMLElement) => {
    pinched = pinch.handleTouchstart(event);
    if (!getShowOverLayout()) readPress.handlePress(event);
    if (pinched) return;

    if (!el.closest('.color-picker')) {
      const { emitter } = app.value;
      emitter.emit(closeColorPickerAction());
    }

    if (
      isMiddleButtonPress(event) &&
      isTakenOver(app.value.store.state) &&
      !el.closest(TAKEOVER_CHROME)
    ) {
      event.preventDefault();
      moveEnd$.pipe(take(1)).subscribe(preventMiddleLift());
    }
  };

  const handleDragSelect = (event: MouseEvent | TouchEvent) => {
    const el = event.target as HTMLElement | null;
    swallowContextmenu = false;
    if (!el) return;
    // No marquee, selection or carry starts here while readonly.
    if (props.readonly) return handleReadPress(event, el);
    if (pinch.handleTouchstart(event)) return;

    const showOverLayout = getShowOverLayout();
    const canHideColorPicker = !el.closest('.color-picker');
    // A group's body is canvas to the main button: it pans, takes a marquee
    // and unselects; its title bar and sashes, like a table or memo, do not.
    const onEntity = ownsPress(sceneHit(canvas.value, event), event);

    // The editing surface sits beside the stage container rather than inside
    // it, so sceneHit cannot see it and the entity it is open over cannot
    // answer for it. The dom scene had the editor inside .table and .memo.
    const onEditor = Boolean(el.closest('.edit-overlay'));

    const canUnselectAll =
      !onEntity &&
      !onEditor &&
      !el.closest('.edit-input') &&
      !el.closest('.context-menu-content') &&
      !el.closest('.draw-target') &&
      canHideColorPicker;

    const canDrag =
      canUnselectAll &&
      canHideColorPicker &&
      !el.closest('.content-compass') &&
      !el.closest('.floating-toolbar') &&
      !el.closest('.minimap') &&
      !el.closest('.minimap-viewport') &&
      !el.closest('.virtual-scroll') &&
      !el.closest('.welcome-screen-menu') &&
      !showOverLayout;

    const middlePress = isMiddleButtonPress(event);

    // The hand tool takes the pointer off the stage container, whose pan takes
    // a middle press first everywhere else, so the root reads the same rule:
    // the selection stays, no marquee, and the press and its lift are prevented.
    const middlePan = canDrag && middlePress;

    // A takeover stands a scene of its own over this canvas, and the middle
    // button reads alike there: over the scene the selection under it stays,
    // and the press and its lift are prevented; its chrome keeps its presses.
    const middleOverTakeover =
      canUnselectAll &&
      middlePress &&
      isTakenOver(app.value.store.state) &&
      !el.closest(TAKEOVER_CHROME);

    const unselects = canUnselectAll && !middlePan && !middleOverTakeover;
    if (unselects) {
      const { store } = app.value;
      store.dispatch(unselectAllAction$());
    }

    // A press that changes the selection puts out a jump's light; a pan, by
    // the middle button or the hand tool, leaves it on.
    const { editor } = app.value.store.state;
    if (!editor.handTool && (unselects || (onEntity && !middlePress))) {
      clearRelationshipHighlight(editor.id);
    }

    if (canHideColorPicker) {
      const { emitter } = app.value;
      emitter.emit(closeColorPickerAction());
    }

    if (middleOverTakeover) {
      event.preventDefault();
      moveEnd$.pipe(take(1)).subscribe(preventMiddleLift());
    }

    if (!canDrag) return;
    if (middlePan) event.preventDefault();

    // The draw mode takes the stage off the pointer, as the hand tool does, so
    // every press lands here: the main button draws, the middle one still pans
    // and any other ends the mode.
    if (drawsTableGroup() && !middlePan) {
      if (isMainButtonPress(event)) {
        groupDraw.start(event);
      } else {
        swallowContextmenu = true;
        cancelTableGroupDraw();
      }
      return;
    }

    if (!middlePan && isMouseEvent(event) && isMod(event)) {
      event.preventDefault();
      const { emitter } = app.value;
      const { x, y } = root.value.getBoundingClientRect();
      emitter.emit(
        dragSelectStartAction({
          x: event.clientX - x,
          y: event.clientY - y,
          source: SOURCE,
        })
      );
    } else {
      if (app.value.store.state.editor.handTool) {
        state.grabCursor = 'grabbing';
      }

      // Before the first move rather than on it: the selection a press starts
      // is already there by the time a mousemove could preventDefault it, and
      // the native drag it turns into is what eats the mouseup this ends on.
      const restoreSelection = suppressSelection(editorRootOf(root.value));

      const pan = drag$.subscribe({
        next: handleMove,
        complete: () => {
          state.grabCursor = 'grab';
        },
      });
      pan.add(restoreSelection);
      if (middlePan) pan.add(preventMiddleLift());
    }
  };

  const handleChangeColorPicker = (color: string) => {
    const { store } = app.value;
    store.dispatch(changeColorAllAction$(color));
  };

  const handleCloseColorPicker = () => {
    state.colorPickerShow = false;
  };

  /**
   * No color clears what the picker colors and closes it; the picker hands the
   * keyboard back as it goes.
   */
  const handleClearColorPicker = () => {
    const { store } = app.value;
    store.dispatch(removeColorAllAction$());
    state.colorPickerShow = false;
  };

  /**
   * Escape pressed while the keyboard is elsewhere closes the picker unless something takes it
   * first; removeSelection or removeTable (Delete or Backspace,
   * bare or with the mod key) closes it too, since either may just have taken its paint.
   */
  const handleColorPickerShortcut = ({ type }: { type: KeyBindingName }) => {
    const { editor } = app.value.store.state;

    if (
      type === KeyBindingName.removeSelection ||
      type === KeyBindingName.removeTable ||
      (type === KeyBindingName.stop &&
        !editor.openMap[Open.search] &&
        !isEditingText(editor) &&
        !editor.drawRelationship &&
        !editor.drawTableGroup)
    ) {
      state.colorPickerShow = false;
    }
  };

  /**
   * The moves, the groups wrapped round them and the view centred on where they
   * land go out as one dispatch, so the history holds them as one entry and a
   * single undo puts the tables, the groups and the view back together.
   */
  const handleChangeAutomaticTablePlacement = (tables: TablePoint[]) => {
    const { store } = app.value;
    store.dispatch(toPlacementActions(store.state, tables, SOURCE));
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
        const scenePoint = toScenePoint(
          getSceneTransform(store.state, SOURCE),
          {
            x: event.clientX - rect.x,
            y: event.clientY - rect.y,
          }
        );

        store.dispatch(sharedMouseTrackerAction(scenePoint));
      });
  };

  onMounted(() => {
    const { store, emitter, shortcut$ } = app.value;
    const $root = root.value;

    if (props.mouseTracking) {
      handleMouseTrackerStart();
    }
    listenHover(props.readonly);

    addUnsubscribe(
      watch(props).subscribe(propName => {
        if (propName === 'readonly') handleReadonlyTurn();
        if (propName !== 'mouseTracking') return;

        props.mouseTracking
          ? handleMouseTrackerStart()
          : handleMouseTrackerEnd();
      }),
      shortcut$.subscribe(handleColorPickerShortcut),
      // A document a host loads replaces the one a readonly press lit on.
      store.subscribe(actions => {
        if (
          props.readonly &&
          actions.some(({ type }) => type === initialLoadJsonAction.type)
        ) {
          readPress.reset();
        }
      }),
      emitter.on({
        openColorPicker: ({ payload: { x, y, color } }) => {
          // A reader colours nothing, and the element closed the picker as
          // it turned readonly, so none opens again until it turns writable.
          if (props.readonly) return;

          const open = () => {
            const rect = $root.getBoundingClientRect();

            state.colorPickerX = x - rect.x;
            state.colorPickerY = y - rect.y;
            state.colorPickerViewport = store.state.editor.viewport;
            state.colorPickerInitialColor = color;
            state.colorPickerDocumentColors = getDocumentColors(store.state);
            state.colorPickerShow = true;
          };

          // The picker reads its props once as it mounts, so one already open
          // goes away first and the next tick mounts it again on the new color.
          if (state.colorPickerShow) {
            state.colorPickerShow = false;
            nextTick(open);
          } else {
            open();
          }
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
        openAutomaticTablePlacement: ({ payload: { placement } }) => {
          // Only the simulation is worth watching settle, so only it opens the
          // preview. ELK answers in one go and its layout is applied where the
          // document already is.
          if (isElkPlacement(placement)) {
            runElkPlacement(
              app.value,
              placement,
              handleChangeAutomaticTablePlacement
            );
            return;
          }

          store.dispatch(
            changeOpenMapAction({ [Open.automaticTablePlacement]: true })
          );
        },
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
    const { handTool, zenMode } = store.state.editor;
    // An empty document has no travel and draws no scrollbar; the map of it
    // would be as empty, so it is left out the same way. Read off the lists,
    // so a drag step, which moves rects alone, does not run this render again.
    const showMinimap = hasContent(store.state) && !zenMode;
    // An open overlay stands a scene of its own over this canvas, so the tools
    // that drive this one step aside rather than float over it.
    const showFloatingToolbar = !getShowOverLayout();
    // Only for a host that asks, over a still empty document the reader may
    // edit, so the first table, shown memo or shown group takes it away and an
    // undo brings it again, never after appDestroy, which empties it too.
    const showWelcomeScreen =
      Boolean(props.enableWelcomeScreen) &&
      !app.value.lifecycle.destroyed &&
      !props.readonly &&
      !zenMode &&
      !getShowOverLayout() &&
      isEmptyDocument(store.state);

    const drawsGroup = drawsTableGroup();
    const cursor = readPress.state.panning
      ? 'grabbing'
      : handTool
        ? state.grabCursor
        : drawsGroup
          ? 'crosshair'
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
        <Canvas
          root={root}
          canvas={canvas}
          grabMove={(handTool && !props.readonly) || drawsGroup}
          overlay={props.readonly ? undefined : EditOverlay}
          layers={editingLayers}
        />
        <DrawTargetButtons root={root} readonly={props.readonly} />
        {drawsGroup ? <TableGroupDraft draw={groupDraw.state} /> : null}
        {zenMode ? null : <VirtualScroll />}
        {showMinimap ? <Minimap /> : null}
        {showWelcomeScreen ? (
          <WelcomeScreen
            enableThemeBuilder={props.enableThemeBuilder}
            enableLocalePicker={props.enableLocalePicker}
          />
        ) : null}
        {showFloatingToolbar ? (
          <FloatingToolbar readonly={props.readonly} />
        ) : null}
        {contextMenu.state.show ? (
          <ErdContextMenu
            type={state.contextMenuType}
            relationshipId={state.relationshipId}
            tableId={state.tableId}
            columnId={state.columnId}
            memoId={state.memoId}
            tableGroupId={state.tableGroupId}
            onClose={handleContextmenuClose}
          />
        ) : null}
        {state.colorPickerShow ? (
          <ColorPicker
            color={state.colorPickerInitialColor}
            x={state.colorPickerX}
            y={state.colorPickerY}
            viewport={state.colorPickerViewport}
            keyBindingMap={app.value.keyBindingMap}
            documentColors={state.colorPickerDocumentColors}
            onChange={handleChangeColorPicker}
            onClear={handleClearColorPicker}
            onClose={handleCloseColorPicker}
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
            readonly={props.readonly}
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
