/** @jsxHost konva */

import { query } from '@dineug/erd-editor-schema';
import { FC, observable, onMounted, onUnmounted, repeat } from '@dineug/r-html';
import { round } from 'es-toolkit/compat';
import { Subscription } from 'rxjs';

import { useAppContext } from '@/components/appContext';
import HighLevelTableView from '@/components/erd/canvas/high-level-table/HighLevelTable';
import MemoView from '@/components/erd/canvas/memo/Memo';
import TableView from '@/components/erd/canvas/table/Table';
import { DUPLICATE_MIN_MOVE, START_ADD } from '@/constants/layout';
import { duplicateAction$ } from '@/engine/modules/editor/generator.actions';
import { SelectType } from '@/engine/modules/editor/state';
import { useUnmounted } from '@/hooks/useUnmounted';
import type { Memo, Table } from '@/internal-types';
import { drag$ } from '@/utils/globalEventObservable';
import { isHighLevelTable } from '@/utils/validation';

/**
 * Translucent as one layer rather than per ghost, so a dragged cluster does not
 * turn into opaque patches where its ghosts overlap.
 */
const GHOST_OPACITY = 0.6;

export type DuplicateGhostProps = {};

/**
 * The Alt-drag copies, drawn on the presence layer above the scene. Ghost
 * geometry is schema coordinates read from table.ui, and the drag delta rides
 * on the group above them, so both halves compose into the committed offset.
 */
const DuplicateGhost: FC<DuplicateGhostProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const { addUnsubscribe } = useUnmounted();
  const state = observable({
    tables: [] as Table[],
    memos: [] as Memo[],
    ghostDx: 0,
    ghostDy: 0,
  });

  let subscription: Subscription | null = null;
  let unmounted = false;

  onUnmounted(() => {
    unmounted = true;
  });

  const clear = () => {
    state.tables = [];
    state.memos = [];
    state.ghostDx = 0;
    state.ghostDy = 0;
  };

  const commit = () => {
    if (unmounted || (state.tables.length === 0 && state.memos.length === 0)) {
      return;
    }

    const { store } = app.value;
    const { zoomLevel } = store.state.settings;
    const { ghostDx, ghostDy } = state;
    const tableIds = state.tables.map(table => table.id);
    const memoIds = state.memos.map(memo => memo.id);

    const movedOnScreen = (Math.abs(ghostDx) + Math.abs(ghostDy)) * zoomLevel;
    const dropped = movedOnScreen >= DUPLICATE_MIN_MOVE;

    clear();

    store.dispatch(
      duplicateAction$({
        tableIds,
        memoIds,
        offset: dropped
          ? { x: round(ghostDx, 4), y: round(ghostDy, 4) }
          : { x: START_ADD, y: START_ADD },
        escapeCollision: !dropped,
      })
    );
  };

  const handleDragStart = (
    payload: { tableIds: string[]; memoIds: string[] } | void
  ) => {
    const { store } = app.value;
    const {
      editor: { selectedMap },
      collections,
    } = store.state;

    const selectedTableIds: string[] = [];
    const selectedMemoIds: string[] = [];

    if (payload) {
      selectedTableIds.push(...payload.tableIds);
      selectedMemoIds.push(...payload.memoIds);
    } else {
      for (const [id, selectType] of Object.entries(selectedMap)) {
        if (selectType === SelectType.table) {
          selectedTableIds.push(id);
        } else if (selectType === SelectType.memo) {
          selectedMemoIds.push(id);
        }
      }
    }

    const tables = query(collections)
      .collection('tableEntities')
      .selectByIds(selectedTableIds);
    const memos = query(collections)
      .collection('memoEntities')
      .selectByIds(selectedMemoIds);

    if (tables.length === 0 && memos.length === 0) return;

    subscription?.unsubscribe();

    state.tables = tables;
    state.memos = memos;
    state.ghostDx = 0;
    state.ghostDy = 0;

    // Divided per frame rather than once at commit, so render and commit share
    // one number and a mid-drag zoom stays correct.
    subscription = drag$.subscribe({
      next: ({ movementX, movementY }) => {
        const { zoomLevel } = app.value.store.state.settings;
        state.ghostDx += movementX / zoomLevel;
        state.ghostDy += movementY / zoomLevel;
      },
      complete: commit,
    });
  };

  onMounted(() => {
    const { emitter } = app.value;

    addUnsubscribe(
      emitter.on({
        duplicateDragStart: ({ payload }) => handleDragStart(payload),
      }),
      () => subscription?.unsubscribe()
    );
  });

  return () => {
    const { tables, memos, ghostDx, ghostDy } = state;
    if (tables.length === 0 && memos.length === 0) return null;

    // Read live rather than frozen with the entities: a wheel-zoom across the
    // threshold mid-drag swaps the originals, and the ghosts follow.
    const highLevel = isHighLevelTable(
      app.value.store.state.settings.zoomLevel
    );

    return (
      <k-group
        id="duplicate-ghost-layer"
        name="duplicate-ghost-layer"
        kind="duplicate-ghost-layer"
        x={ghostDx}
        y={ghostDy}
        opacity={GHOST_OPACITY}
        listening={false}
      >
        {repeat(
          tables,
          table => table.id,
          table => (
            <k-group
              id={`duplicate-ghost-${table.id}`}
              name="duplicate-ghost"
              kind={`duplicate-ghost-${SelectType.table}`}
            >
              {highLevel ? (
                <HighLevelTableView table={table} preview={true} />
              ) : (
                <TableView table={table} preview={true} />
              )}
            </k-group>
          )
        )}
        {repeat(
          memos,
          memo => memo.id,
          memo => (
            <k-group
              id={`duplicate-ghost-${memo.id}`}
              name="duplicate-ghost"
              kind={`duplicate-ghost-${SelectType.memo}`}
            >
              <MemoView memo={memo} preview={true} />
            </k-group>
          )
        )}
      </k-group>
    );
  };
};

export default DuplicateGhost;
