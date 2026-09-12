import { query } from '@dineug/erd-editor-schema';
import type { AnyAction } from '@dineug/r-html';
import { filter, tap, throttleTime } from 'rxjs';

import { ColumnOption, StartRelationshipType } from '@/constants/schema';
import type { Hook, HookEffect } from '@/engine/hooks';
import {
  initialLoadJsonAction,
  loadJsonAction,
} from '@/engine/modules/editor/atom.actions';
import { ViewKind } from '@/engine/modules/editor/state';
import { getActiveView, isViewShown } from '@/engine/modules/editor/view';
import {
  viewChangeHopAction,
  viewChangeShowModeAction,
  viewChangeZoomLevelAction,
  viewCloseAction,
  viewHistoryMoveAction,
  viewMoveTableAction,
  viewOpenAction,
  viewScrollToAction,
  viewSetCentersAction,
  viewSetLayoutAction,
  viewStreamScrollToAction,
  viewStreamZoomLevelAction,
} from '@/engine/modules/editor/view.actions';
import { moveMemoAction } from '@/engine/modules/memo/atom.actions';
import {
  addRelationshipAction,
  removeRelationshipAction,
} from '@/engine/modules/relationship/atom.actions';
import {
  changeMaxWidthCommentAction,
  changeShowAction,
} from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableCommentAction,
  changeTableNameAction,
  moveTableAction,
  moveToTableAction,
  removeTableAction,
  sortTableAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnCommentAction,
  changeColumnDataTypeAction,
  changeColumnDefaultAction,
  changeColumnNameAction,
  changeColumnNotNullAction,
  changeColumnPrimaryKeyAction,
  removeColumnAction,
} from '@/engine/modules/table-column/atom.actions';
import { RootState } from '@/engine/state';
import { getVisibleIds } from '@/konva/scene/viewLayout';
import { arrayHas } from '@/utils/arrayHas';
import { bHas } from '@/utils/bit';
import { invalidateTableWidths } from '@/utils/calcTable';
import type { ViewSource } from '@/utils/draw-relationship/geometrySource';
import { relationshipSort } from '@/utils/draw-relationship/sort';

const identificationHook: HookEffect = (action$, getState) =>
  action$
    .pipe(throttleTime(10, undefined, { leading: false, trailing: true }))
    .subscribe(() => {
      const { doc, collections } = getState();
      const collection = query(collections).collection('relationshipEntities');
      const relationships = collection.selectByIds(doc.relationshipIds);

      for (const relationship of relationships) {
        const { end, identification } = relationship;
        const table = query(collections)
          .collection('tableEntities')
          .selectById(end.tableId);
        if (!table) continue;

        const has = arrayHas(table.columnIds);
        const columns = query(collections)
          .collection('tableColumnEntities')
          .selectByIds(end.columnIds)
          .filter(column => has(column.id));
        if (!columns.length) continue;

        const value = columns.every(column =>
          bHas(column.options, ColumnOption.primaryKey)
        );

        if (value === identification) {
          continue;
        }

        relationship.identification = value;
      }
    });

const startRelationshipHook: HookEffect = (action$, getState) =>
  action$
    .pipe(throttleTime(10, undefined, { leading: false, trailing: true }))
    .subscribe(() => {
      const { doc, collections } = getState();
      const collection = query(collections).collection('relationshipEntities');
      const relationships = collection.selectByIds(doc.relationshipIds);

      for (const relationship of relationships) {
        const { end, startRelationshipType } = relationship;
        const table = query(collections)
          .collection('tableEntities')
          .selectById(end.tableId);
        if (!table) continue;

        const has = arrayHas(table.columnIds);
        const columns = query(collections)
          .collection('tableColumnEntities')
          .selectByIds(end.columnIds)
          .filter(column => has(column.id));
        if (!columns.length) continue;

        const value = columns.every(column =>
          bHas(column.options, ColumnOption.notNull)
        )
          ? StartRelationshipType.dash
          : StartRelationshipType.ring;

        if (value === startRelationshipType) {
          continue;
        }

        relationship.startRelationshipType = value;
      }
    });

/**
 * Actions that move something without changing what it contains. Every other
 * action this hook wakes on can change a table's width, and the routing layer
 * caches those widths across sorts.
 */
const isMoveOnly = arrayHas<string>([
  moveTableAction.type,
  moveToTableAction.type,
  moveMemoAction.type,
]);

const relationshipSortHook: HookEffect = (action$, getState) =>
  action$
    .pipe(
      // Invalidation reads every action, the sort reads one per window. Putting
      // this after the throttle would drop the width-changing action whenever
      // it shared a window with a move.
      tap(action => {
        if (!isMoveOnly(action.type)) invalidateTableWidths();
      }),
      throttleTime(5, undefined, { leading: false, trailing: true })
    )
    .subscribe(() => {
      relationshipSort(getState());
    });

/**
 * Document actions a view never sees the effect of: a view draws no memo and
 * reads none of the show bits or the comment width, so its geometry is the
 * same on either side of them.
 */
const isDocumentOnly = arrayHas<string>([
  changeShowAction.type,
  changeMaxWidthCommentAction.type,
  moveMemoAction.type,
]);

/** View actions that move the placement a view is looked at through, and nothing in it. */
const isViewTransform = arrayHas<string>([
  viewScrollToAction.type,
  viewStreamScrollToAction.type,
  viewChangeZoomLevelAction.type,
  viewStreamZoomLevelAction.type,
]);

const idOf = ({ id }: { id: string }) => [id];
const idsOf = ({ ids }: { ids: string[] }) => ids;
const tableIdOf = ({ tableId }: { tableId: string }) => [tableId];

const kindOf = (_: RootState, { kind }: { kind: ViewSource }) => kind;
const focusOnly = () => ViewKind.focus;
const namedOrActiveKind = (state: RootState, { kind }: { kind?: ViewSource }) =>
  kind ?? getActiveView(state)?.kind ?? null;

/**
 * The one view an action reaches: the kind it names, the Focus view for the
 * centers and the hop, and for a move or a show mode the kind named, else the
 * active view. A document action reaches whichever view shows what it names.
 */
const aimedKind: Record<
  string,
  (state: RootState, payload: any) => ViewSource | null
> = {
  [viewOpenAction.type]: kindOf,
  [viewCloseAction.type]: kindOf,
  [viewSetLayoutAction.type]: kindOf,
  [viewChangeHopAction.type]: focusOnly,
  [viewSetCentersAction.type]: focusOnly,
  [viewHistoryMoveAction.type]: focusOnly,
  [viewChangeShowModeAction.type]: namedOrActiveKind,
  [viewMoveTableAction.type]: namedOrActiveKind,
};

/**
 * The table or connector an action names, for the ones that name any. An
 * action absent here touches the whole view: it opens, closes or re-centers
 * one, replaces a layout, or lays the document out again.
 */
const namedIds: Record<string, (payload: any) => string[]> = {
  [addTableAction.type]: idOf,
  [removeTableAction.type]: idOf,
  [moveToTableAction.type]: idOf,
  [changeTableNameAction.type]: idOf,
  [changeTableCommentAction.type]: idOf,
  [addRelationshipAction.type]: idOf,
  [removeRelationshipAction.type]: idOf,
  [moveTableAction.type]: idsOf,
  [viewMoveTableAction.type]: idsOf,
  [addColumnAction.type]: tableIdOf,
  [removeColumnAction.type]: tableIdOf,
  [changeColumnNameAction.type]: tableIdOf,
  [changeColumnCommentAction.type]: tableIdOf,
  [changeColumnDataTypeAction.type]: tableIdOf,
  [changeColumnDefaultAction.type]: tableIdOf,
  [changeColumnPrimaryKeyAction.type]: tableIdOf,
};

/**
 * Whether an action can change what one view's sort reads. A named table or
 * connector counts when that view shows it now or showed it at the last sort,
 * the second for a removal, whose id has left the view by the time the hook runs.
 */
function touchesView(
  state: RootState,
  action: AnyAction,
  lastRead: Set<string>,
  source: ViewSource
): boolean {
  if (isDocumentOnly(action.type) || isViewTransform(action.type)) return false;

  const aimed = aimedKind[action.type];
  if (aimed && aimed(state, action.payload) !== source) return false;

  const named = namedIds[action.type];
  if (!named) return true;

  const { tableIds, relationshipIds } = getVisibleIds(state, source);
  const shown = new Set([...tableIds, ...relationshipIds]);
  return named(action.payload).some(id => shown.has(id) || lastRead.has(id));
}

const VIEW_SOURCES: ViewSource[] = [ViewKind.flow, ViewKind.focus];

/**
 * Each view's own sort, into that view's channel, over the tables it shows at
 * the points it places them. The document sort above is untouched: this runs
 * beside it for every view a scene is drawing, active or not, and only for what that view shows.
 */
const viewRelationshipSortHook: HookEffect = (action$, getState) => {
  const lastRead: Record<ViewSource, Set<string>> = {
    flow: new Set(),
    focus: new Set(),
  };
  const pending = new Set<ViewSource>();

  return action$
    .pipe(
      filter(action => {
        const state = getState();
        let touched = false;
        for (const source of VIEW_SOURCES) {
          if (
            isViewShown(state, source) &&
            touchesView(state, action, lastRead[source], source)
          ) {
            pending.add(source);
            touched = true;
          }
        }
        return touched;
      }),
      throttleTime(5, undefined, { leading: false, trailing: true })
    )
    .subscribe(() => {
      const state = getState();
      const sources = [...pending];
      pending.clear();

      for (const source of sources) {
        if (!isViewShown(state, source)) continue;

        relationshipSort(state, source);
        const { tableIds, relationshipIds } = getVisibleIds(state, source);
        lastRead[source] = new Set([...tableIds, ...relationshipIds]);
      }
    });
};

/** Every document action after which the connectors are laid out again. */
const layoutActions = [
  changeShowAction,
  changeMaxWidthCommentAction,
  addRelationshipAction,
  removeRelationshipAction,
  moveMemoAction,
  // Routing reads every table in the document, not only the two a
  // relationship connects, so the set of tables is part of its input: a
  // table appearing between two connected ones has to trigger a sort.
  addTableAction,
  removeTableAction,
  moveTableAction,
  moveToTableAction,
  changeTableNameAction,
  changeTableCommentAction,
  addColumnAction,
  removeColumnAction,
  changeColumnNameAction,
  changeColumnCommentAction,
  changeColumnDataTypeAction,
  changeColumnDefaultAction,
  sortTableAction,
];

/**
 * Document actions the document sort ignores but a view reads: a key flag adds
 * no row to the document, but a view on its key rows gains or loses one by it.
 * The foreign key flag is set by hooks on the relationship actions above.
 */
const viewRowActions = [changeColumnPrimaryKeyAction];

/**
 * What can open, close, re-center or re-lay a view. A tab switch is not one:
 * a Flow view kept across tabs is left alone while its tab is away, and the
 * layout its scene stands it back on when the tab returns is what sorts it again.
 */
const viewLayoutActions = [
  viewOpenAction,
  viewCloseAction,
  viewScrollToAction,
  viewStreamScrollToAction,
  viewChangeZoomLevelAction,
  viewStreamZoomLevelAction,
  viewMoveTableAction,
  viewSetLayoutAction,
  viewChangeShowModeAction,
  viewChangeHopAction,
  viewSetCentersAction,
  viewHistoryMoveAction,
];

export const hooks: Hook[] = [
  [
    [
      removeColumnAction,
      changeColumnPrimaryKeyAction,
      loadJsonAction,
      initialLoadJsonAction,
    ],
    identificationHook,
  ],
  [
    [
      removeColumnAction,
      changeColumnNotNullAction,
      loadJsonAction,
      initialLoadJsonAction,
    ],
    startRelationshipHook,
  ],
  [layoutActions, relationshipSortHook],
  [
    [...layoutActions, ...viewRowActions, ...viewLayoutActions],
    viewRelationshipSortHook,
  ],
];
