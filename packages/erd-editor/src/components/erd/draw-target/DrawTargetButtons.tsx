import { query } from '@dineug/erd-editor-schema';
import { FC, observer, onMounted, Ref } from '@dineug/r-html';
import { fromEvent } from 'rxjs';

import { useAppContext } from '@/components/appContext';
import {
  clearDrawTarget,
  getDrawTarget,
  updateDrawTarget,
} from '@/components/erd/draw-target/drawTargetState';
import {
  findDrawTarget,
  hasTravelled,
} from '@/components/erd/draw-target/findDrawTarget';
import {
  getGutterRect,
  type PillPlacement,
  type PillSize,
  placePill,
} from '@/components/erd/draw-target/placePill';
import {
  coveredWidth,
  isTakenOver,
} from '@/components/find-replace/panelLayout';
import { useI18n } from '@/components/localeContext';
import { nameOf } from '@/components/map-columns/nameOf';
import { openMapColumns } from '@/components/map-columns/openMapColumns';
import Icon from '@/components/primitives/icon/Icon';
import { Open } from '@/constants/open';
import { CanvasType } from '@/constants/schema';
import { drawEndRelationshipAction } from '@/engine/modules/editor/atom.actions';
import { getActiveView } from '@/engine/modules/editor/view';
import { getStartKeyColumns } from '@/engine/modules/relationship/fkColumns';
import { selectTableAction$ } from '@/engine/modules/table/generator.actions';
import type { RootState } from '@/engine/state';
import { useUnmounted } from '@/hooks/useUnmounted';
import type { Point } from '@/internal-types';
import { getTableRect, type Rect } from '@/konva/scene/metrics';
import { getSceneTransform, toScreenPoint } from '@/konva/scene/viewport';
import { isMainButtonPress } from '@/utils/domEvent';

import * as styles from './DrawTargetButtons.styles';

export type DrawTargetButtonsProps = {
  root: Ref<HTMLDivElement>;
  readonly: boolean;
};

const ICON_SIZE = 16;

/** The chrome over the canvas a pointer on which points at no table. */
const CANVAS_CHROME = [
  '.minimap',
  '.minimap-viewport',
  '.floating-toolbar',
  '.virtual-scroll',
  '.content-compass',
  '.context-menu-content',
  '.color-picker',
  '.edit-overlay',
].join(', ');

/** The chrome painted over the buttons, which they stand clear of. */
const OBSTACLES = '.minimap, .floating-toolbar';

const PILL_INSET = styles.PILL_PADDING + styles.PILL_BORDER;

/** The pill at the size the stylesheet gives it: two buttons, the gap and the padding. */
export const PILL_SIZE: PillSize = {
  width: styles.PILL_BUTTON + PILL_INSET * 2,
  height: styles.PILL_BUTTON * 2 + styles.PILL_GAP + PILL_INSET * 2,
};

/** A table's box on screen, its two corners read through the canvas placement. */
function toScreenRect(state: RootState, rect: Rect): Rect {
  const transform = getSceneTransform(state, 'document');
  const topLeft = toScreenPoint(transform, rect);
  const bottomRight = toScreenPoint(transform, {
    x: rect.x + rect.width,
    y: rect.y + rect.height,
  });

  return {
    x: topLeft.x,
    y: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y,
  };
}

const boxStyle = ({ x, y, width, height }: Rect) => ({
  left: `${x}px`,
  top: `${y}px`,
  width: `${width}px`,
  height: `${height}px`,
});

type TargetLayout = {
  card: Rect;
  placement: PillPlacement;
  pill: PillSize;
  gutter: Rect | null;
};

/**
 * The two buttons beside the table a relationship is drawn to: one maps the
 * parent's key to columns the child already has, the other adds new ones as a
 * press on the table does. A layer of the document canvas, never of a view.
 */
const DrawTargetButtons: FC<DrawTargetButtonsProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const i18n = useI18n(ctx);
  const { addUnsubscribe } = useUnmounted();

  /** The last press on the canvas, which is the press that started a draw once one starts. */
  let lastPress: Point | null = null;
  /** The start of the draw followed here, a press on a table setting a new one each time. */
  let followed: object | null = null;
  /** Whether a finger made the last press or move on the canvas, which leaves no pointer to read. */
  let touched = false;

  const canOffer = (state: RootState) => {
    const { editor, settings } = state;

    return (
      Boolean(editor.drawRelationship?.start) &&
      settings.canvasType === CanvasType.ERD &&
      !props.readonly &&
      !app.value.store.getReadonly() &&
      !editor.handTool &&
      !isTakenOver(state) &&
      !editor.openMap[Open.tableProperties] &&
      !editor.openMap[Open.mapColumns] &&
      !getActiveView(state)
    );
  };

  const toRootPoint = (point: { clientX: number; clientY: number }) => {
    const $root = props.root.value;
    if (!$root) return null;

    const box = $root.getBoundingClientRect();
    return { x: point.clientX - box.x, y: point.clientY - box.y };
  };

  const readObstacles = (): Rect[] => {
    const $root = props.root.value;
    if (!$root) return [];

    const rootBox = $root.getBoundingClientRect();
    return Array.from($root.querySelectorAll(OBSTACLES)).map(el => {
      const box = el.getBoundingClientRect();
      return {
        x: box.x - rootBox.x,
        y: box.y - rootBox.y,
        width: box.width,
        height: box.height,
      };
    });
  };

  const layoutOf = (state: RootState, tableId: string): TargetLayout | null => {
    const table = query(state.collections)
      .collection('tableEntities')
      .selectById(tableId);
    if (!table || !state.doc.tableIds.includes(tableId)) return null;

    const card = toScreenRect(state, getTableRect(state, table));
    const { viewport } = state.editor;
    const shown =
      card.x < viewport.width &&
      card.x + card.width > 0 &&
      card.y < viewport.height &&
      card.y + card.height > 0;
    if (!shown) return null;

    const pill = PILL_SIZE;
    const placement = placePill({
      card,
      viewport,
      covered: coveredWidth(state),
      obstacles: readObstacles(),
      pill,
    });
    const gutter = getGutterRect({ card, viewport, placement, pill });

    return { card, placement, pill, gutter };
  };

  const keepRects = ({ placement, pill, gutter }: TargetLayout): Rect[] => {
    const buttons = { x: placement.x, y: placement.y, ...pill };
    return gutter ? [buttons, gutter] : [buttons];
  };

  /**
   * Decides the table the buttons stand beside whenever what it reads moves:
   * the pointer, the canvas placement, or a table a peer or an agent moved,
   * resized or removed. A draw's start and its end bound what it holds.
   */
  const follow = () => {
    const { state } = app.value.store;
    const start = state.editor.drawRelationship?.start ?? null;

    if (!start) {
      if (followed !== null) clearDrawTarget(state);
      followed = null;
      return;
    }

    if (followed !== start) {
      followed = start;
      updateDrawTarget(state, {
        pressPoint: lastPress,
        selfArmed: false,
        targetId: null,
      });
    }

    const target = getDrawTarget(state);

    // The tab switched away keeps the draw armed, as it always has, and drops
    // only the pointer, which the next move over the canvas reads again.
    if (state.settings.canvasType !== CanvasType.ERD) {
      updateDrawTarget(state, { pointer: null, targetId: null });
      return;
    }

    if (!target.pointer || !canOffer(state)) {
      updateDrawTarget(state, { targetId: null });
      return;
    }

    const current = target.targetId;
    const layout = current ? layoutOf(state, current) : null;

    updateDrawTarget(state, {
      targetId: findDrawTarget(state, {
        pointer: target.pointer,
        startTableId: start.tableId,
        selfArmed: target.selfArmed,
        current,
        keep: layout ? keepRects(layout) : [],
      }),
    });
  };

  const handlePress = (event: MouseEvent | TouchEvent) => {
    const point = 'touches' in event ? event.touches[0] : event;
    lastPress = point ? toRootPoint(point) : null;
  };

  const dropPointer = () => {
    const { state } = app.value.store;
    if (getDrawTarget(state).pointer === null) return;

    updateDrawTarget(state, { pointer: null });
  };

  /**
   * A browser sends a pointer event ahead of each mouse event a mouse or a pen
   * makes, and none ahead of those it makes up after a tap, so the kind of the
   * last one tells a hover from a finger.
   */
  const handlePointerKind = (event: PointerEvent) => {
    touched = event.pointerType === 'touch';
  };

  /** A finger has no hover, so its press lets go of the pointer a mouse left; a pen's keeps it. */
  const handlePointerDown = (event: PointerEvent) => {
    handlePointerKind(event);
    if (touched) dropPointer();
  };

  const handlePointerMove = (event: MouseEvent) => {
    const { state } = app.value.store;
    if (touched || !state.editor.drawRelationship?.start) return;

    const over = event.target as Element | null;
    if (over?.closest?.(CANVAS_CHROME)) {
      updateDrawTarget(state, { pointer: null });
      return;
    }

    const pointer = toRootPoint(event);
    if (!pointer) return;

    const { pressPoint, selfArmed } = getDrawTarget(state);
    const from = pressPoint ?? pointer;

    updateDrawTarget(state, {
      pointer,
      pressPoint: from,
      selfArmed: selfArmed || hasTravelled(from, pointer),
    });
  };

  /** Keeps the keyboard on the editor and lets the press reach the root, which closes an open menu. */
  const handleButtonsPress = (event: MouseEvent) => {
    event.preventDefault();
  };

  /** Spends a main press here, so it reaches no table under the strip. */
  const handleGutterPress = (event: MouseEvent) => {
    if (!isMainButtonPress(event)) return;

    event.preventDefault();
    event.stopPropagation();
  };

  /** No canvas menu opens over the buttons or the strip beside them. */
  const handleContextmenu = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const startKeyOf = (state: RootState) => {
    const start = state.editor.drawRelationship?.start;
    const table = start
      ? query(state.collections)
          .collection('tableEntities')
          .selectById(start.tableId)
      : undefined;
    if (!table) return { table, hasKey: false };

    return {
      table,
      hasKey: getStartKeyColumns(state.collections, table).length > 0,
    };
  };

  /** What a press on the table draws: new columns for each key column of the start table. */
  const handleNew = (tableId: string) => (event: MouseEvent) => {
    if (!isMainButtonPress(event)) return;

    const { store } = app.value;
    if (!startKeyOf(store.state).hasKey) return;

    store.dispatch(selectTableAction$(tableId, false));
  };

  /**
   * Ends the draw and opens Map Columns between the two tables, writing nothing
   * yet. Either table gone by the press ends the draw alone, and closing the
   * dialog arms no draw again, as a draw made by a press does not.
   */
  const handleMap = (tableId: string) => (event: MouseEvent) => {
    if (!isMainButtonPress(event)) return;

    const { store, emitter } = app.value;
    const draw = store.state.editor.drawRelationship;
    const startTableId = draw?.start?.tableId;
    if (!draw || !startTableId) return;

    const { tableIds } = store.state.doc;
    if (!tableIds.includes(startTableId) || !tableIds.includes(tableId)) {
      store.dispatch(drawEndRelationshipAction());
      return;
    }

    const { relationshipType } = draw;
    store.dispatchSync(drawEndRelationshipAction());
    openMapColumns(
      { store, emitter },
      { mode: 'create', startTableId, endTableId: tableId, relationshipType }
    );
  };

  onMounted(() => {
    const $root = props.root.value;
    const { store } = app.value;

    addUnsubscribe(
      // Captured, so the press is known before the canvas acts on it.
      fromEvent<MouseEvent>($root, 'mousedown', { capture: true }).subscribe(
        handlePress
      ),
      fromEvent<TouchEvent>($root, 'touchstart', { capture: true }).subscribe(
        handlePress
      ),
      fromEvent<PointerEvent>($root, 'pointerdown', {
        capture: true,
      }).subscribe(handlePointerDown),
      fromEvent<PointerEvent>($root, 'pointermove', {
        capture: true,
      }).subscribe(handlePointerKind),
      fromEvent<MouseEvent>($root, 'mousemove').subscribe(handlePointerMove),
      fromEvent<MouseEvent>($root, 'mouseleave').subscribe(dropPointer),
      observer(follow),
      () => clearDrawTarget(store.state)
    );
  });

  return () => {
    const { state } = app.value.store;
    if (!canOffer(state)) return null;

    const tableId = getDrawTarget(state).targetId;
    if (!tableId) return null;

    const layout = layoutOf(state, tableId);
    if (!layout) return null;

    const { card, placement, pill, gutter } = layout;
    const start = startKeyOf(state);
    const { t } = i18n.value;
    const mapTitle = t('mapColumns.mapToExisting');
    const newTitle = start.hasKey
      ? t('mapColumns.createNew')
      : t('mapColumns.noPrimaryKeyToCopy', {
          table: nameOf(start.table, i18n.value),
        });

    return (
      <div class={['draw-target-layer', styles.layer]}>
        <div
          class={['draw-target-outline', styles.outline]}
          style={boxStyle(card)}
        ></div>
        {gutter ? (
          <div
            class={['draw-target', 'draw-target-gutter', styles.gutter]}
            style={boxStyle(gutter)}
            on:mousedown={handleGutterPress}
            on:contextmenu={handleContextmenu}
          ></div>
        ) : null}
        <div
          class={['draw-target', 'draw-target-buttons', styles.pill]}
          data-side={placement.side}
          style={boxStyle({ x: placement.x, y: placement.y, ...pill })}
          on:mousedown={handleButtonsPress}
          on:contextmenu={handleContextmenu}
        >
          <button
            class={['draw-target-map', styles.button]}
            type="button"
            tabindex="-1"
            title={mapTitle}
            aria-label={mapTitle}
            on:click={handleMap(tableId)}
          >
            <Icon name="link" size={ICON_SIZE} />
          </button>
          <button
            class={['draw-target-new', styles.button]}
            type="button"
            tabindex="-1"
            title={newTitle}
            aria-label={newTitle}
            aria-disabled={String(!start.hasKey)}
            on:click={handleNew(tableId)}
          >
            <Icon name="plus" size={ICON_SIZE} />
          </button>
        </div>
      </div>
    );
  };
};

export default DrawTargetButtons;
