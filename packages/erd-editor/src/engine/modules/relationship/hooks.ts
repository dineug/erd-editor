import { query } from '@dineug/erd-editor-schema';
import type { AnyAction } from '@dineug/r-html';
import { isNil } from 'es-toolkit';
import { asapScheduler, filter, observeOn, tap, throttle, timer } from 'rxjs';

import { ColumnOption, Show, StartRelationshipType } from '@/constants/schema';
import type { Hook, HookEffect } from '@/engine/hooks';
import {
  initialLoadJsonAction,
  loadJsonAction,
} from '@/engine/modules/editor/atom.actions';
import { ViewKind } from '@/engine/modules/editor/state';
import { getActiveView, isViewShown } from '@/engine/modules/editor/view';
import {
  viewChangeShowModeAction,
  viewChangeZoomLevelAction,
  viewCloseAction,
  viewMoveTableAction,
  viewOpenAction,
  viewScrollToAction,
  viewSetCentersAction,
  viewSetLayoutAction,
  viewStreamScrollToAction,
  viewStreamZoomLevelAction,
} from '@/engine/modules/editor/view.actions';
import {
  addIndexAction,
  changeIndexUniqueAction,
  removeIndexAction,
} from '@/engine/modules/index/atom.actions';
import {
  addIndexColumnAction,
  moveIndexColumnAction,
  removeIndexColumnAction,
} from '@/engine/modules/index-column/atom.actions';
import { moveMemoAction } from '@/engine/modules/memo/atom.actions';
import {
  addRelationshipAction,
  changeRelationshipColumnsAction,
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
  moveColumnAction,
  removeColumnAction,
} from '@/engine/modules/table-column/atom.actions';
import { RootState } from '@/engine/state';
import { Tag } from '@/engine/tag';
import type { Collections, Column, Relationship } from '@/internal-types';
import { getVisibleIds } from '@/konva/scene/viewLayout';
import { arrayHas } from '@/utils/arrayHas';
import { bHas } from '@/utils/bit';
import { invalidateTableWidths } from '@/utils/calcTable';
import type { ViewSource } from '@/utils/draw-relationship/geometrySource';
import { relationshipSort } from '@/utils/draw-relationship/sort';

/**
 * The columns a relationship ends on that are still in the document: its end
 * table is in the document and holds them. A removed table keeps its entity,
 * and the columns it held with it.
 */
function selectEndColumns(
  collections: Collections,
  hasTable: (id: string) => boolean,
  { end }: Relationship
): Column[] {
  if (!hasTable(end.tableId)) return [];

  const table = query(collections)
    .collection('tableEntities')
    .selectById(end.tableId);
  if (!table) return [];

  const has = arrayHas(table.columnIds);
  return query(collections)
    .collection('tableColumnEntities')
    .selectByIds(end.columnIds)
    .filter(column => has(column.id));
}

/**
 * Each relationship entity with the columns it still ends on. A removed one
 * ends on none, so the flags a file saves for it never hang on arrival order.
 */
function* endColumnsOf({ doc, collections }: RootState) {
  const hasTable = arrayHas(doc.tableIds);
  const hasRelationship = arrayHas(doc.relationshipIds);
  const relationships = query(collections)
    .collection('relationshipEntities')
    .selectAll();

  for (const relationship of relationships) {
    yield [
      relationship,
      hasRelationship(relationship.id)
        ? selectEndColumns(collections, hasTable, relationship)
        : [],
    ] as const;
  }
}

/**
 * Marks each relationship identifying when every column it ends on is a primary
 * key, and not identifying, as a new one starts, once none of them is left or
 * it is removed, so the value follows the document whatever order actions arrive in.
 */
export function recalculateIdentification(state: RootState) {
  for (const [relationship, columns] of endColumnsOf(state)) {
    const value =
      columns.length !== 0 &&
      columns.every(column => bHas(column.options, ColumnOption.primaryKey));

    if (value !== relationship.identification) {
      relationship.identification = value;
    }
  }
}

/**
 * Starts each relationship dashed when every column it ends on is not null and
 * ringed otherwise, read off the columns as the identification is; one with no
 * end column left is dashed, as a new one starts.
 */
export function recalculateStartRelationshipType(state: RootState) {
  for (const [relationship, columns] of endColumnsOf(state)) {
    const value = columns.every(column =>
      bHas(column.options, ColumnOption.notNull)
    )
      ? StartRelationshipType.dash
      : StartRelationshipType.ring;

    if (value !== relationship.startRelationshipType) {
      relationship.startRelationshipType = value;
    }
  }
}

/**
 * Reads the flag once per batch, in the microtask after it, as the foreign key
 * bits are read: a headless peer writes its file one scheduler turn after a
 * batch, and a flag read on a timer reached that file only with the next write.
 */
const identificationHook: HookEffect = (action$, getState) =>
  action$
    .pipe(
      throttle(() => timer(0, asapScheduler), {
        leading: false,
        trailing: true,
      })
    )
    .subscribe(() => recalculateIdentification(getState()));

/**
 * The same one microtask later, behind the not null a key turned on sets in the
 * microtask after its batch: read before it, a batch keying two end columns at
 * once left the relationship ringed.
 */
const startRelationshipHook: HookEffect = (action$, getState) =>
  action$
    .pipe(
      throttle(() => timer(0, asapScheduler), {
        leading: false,
        trailing: true,
      }),
      observeOn(asapScheduler)
    )
    .subscribe(() => recalculateStartRelationshipType(getState()));

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

/**
 * How long a sort waits after the action that opens its window. A move a drag
 * streams keeps 5 ms, so a drag sorts about once a frame; anything else, the
 * undo of that drag included, sorts in a microtask, before the frame drawing it.
 */
const sortWindow = ({ tags }: AnyAction) =>
  !isNil(tags) && bHas(tags, Tag.drag) ? timer(5) : timer(0, asapScheduler);

/**
 * The actions that add, drop, reshape or renumber an alternate key, whose mark
 * widens its table in the document while the setting shows the marks. A column
 * move renumbers the keys, an index column move their members.
 */
const alternateKeyActions = [
  addIndexAction,
  removeIndexAction,
  changeIndexUniqueAction,
  addIndexColumnAction,
  removeIndexColumnAction,
  moveIndexColumnAction,
  moveColumnAction,
];

const alternateKeyActionTypes = alternateKeyActions.map(action => action.type);

const isAlternateKeyAction = arrayHas<string>(alternateKeyActionTypes);

/** The referential action labels shown or hidden, which moves no table and no anchor. */
const isLabelToggle = (action: AnyAction) =>
  action.type === changeShowAction.type &&
  action.payload?.show === Show.hideReferentialAction;

const relationshipSortHook: HookEffect = (action$, getState) =>
  action$
    .pipe(
      // An index changes no width while the marks are hidden, and a checkbox
      // in the Indexes tab would otherwise sort the whole document.
      filter(
        action =>
          (!isAlternateKeyAction(action.type) ||
            bHas(getState().settings.show, Show.columnAlternateKey)) &&
          !isLabelToggle(action)
      ),
      // Invalidation reads every action, the sort reads one per window. Putting
      // this after the throttle would drop the width-changing action whenever
      // it shared a window with a move.
      tap(action => {
        if (!isMoveOnly(action.type)) invalidateTableWidths();
      }),
      throttle(sortWindow, { leading: false, trailing: true })
    )
    .subscribe(() => {
      relationshipSort(getState());
    });

/**
 * Document actions a view's geometry never sees: a view draws no memo and no
 * alternate key mark, reads none of the show bits or the comment width, and a
 * column move reorders its rows without resizing a box.
 */
const isDocumentOnly = arrayHas<string>([
  changeShowAction.type,
  changeMaxWidthCommentAction.type,
  moveMemoAction.type,
  ...alternateKeyActionTypes,
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
const flowOnly = () => ViewKind.flow;
const namedOrActiveKind = (state: RootState, { kind }: { kind?: ViewSource }) =>
  kind ?? getActiveView(state)?.kind ?? null;

/**
 * The one view an action reaches: the kind it names, the Flow view for the
 * centers, and for a move or a show mode the kind named, else the active
 * view. A document action reaches whichever view shows what it names.
 */
const aimedKind: Record<
  string,
  (state: RootState, payload: any) => ViewSource | null
> = {
  [viewOpenAction.type]: kindOf,
  [viewCloseAction.type]: kindOf,
  [viewSetLayoutAction.type]: kindOf,
  [viewSetCentersAction.type]: flowOnly,
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
  [changeRelationshipColumnsAction.type]: ({ id, start, end }) => [
    id,
    start.tableId,
    end.tableId,
  ],
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

/** The tables and connectors one view shows, as one set of ids. */
function shownIds(state: RootState, source: ViewSource): Set<string> {
  const { tableIds, relationshipIds } = getVisibleIds(state, source);
  return new Set([...tableIds, ...relationshipIds]);
}

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

  const shown = shownIds(state, source);
  return named(action.payload).some(id => shown.has(id) || lastRead.has(id));
}

const VIEW_SOURCES: ViewSource[] = [ViewKind.flow];

/**
 * Each view's own sort, into that view's channel, over the tables it shows at
 * the points it places them. The document sort above is untouched: this runs
 * beside it for every view a scene is drawing, active or not, and only for what that view shows.
 */
const viewRelationshipSortHook: HookEffect = (action$, getState) => {
  const lastRead: Record<ViewSource, Set<string>> = {
    flow: new Set(),
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
      throttle(sortWindow, { leading: false, trailing: true })
    )
    .subscribe(() => {
      const state = getState();
      const sources = [...pending];
      pending.clear();

      for (const source of sources) {
        if (!isViewShown(state, source)) continue;

        relationshipSort(state, source);
        lastRead[source] = shownIds(state, source);
      }
    });
};

/** Every document action after which the connectors are laid out again. */
const layoutActions = [
  changeShowAction,
  changeMaxWidthCommentAction,
  addRelationshipAction,
  removeRelationshipAction,
  changeRelationshipColumnsAction,
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
  ...alternateKeyActions,
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
  viewSetCentersAction,
];

/**
 * What can change the columns a relationship ends on or the flags it reads off
 * them: an end column or its table removed or back by an undo, a peer or an
 * agent, a relationship made, remapped or removed, a key flag, and a load.
 */
const identificationActions = [
  addColumnAction,
  removeColumnAction,
  changeColumnPrimaryKeyAction,
  addRelationshipAction,
  removeRelationshipAction,
  changeRelationshipColumnsAction,
  addTableAction,
  removeTableAction,
  loadJsonAction,
  initialLoadJsonAction,
];

/**
 * The same with the not null flag added. The key flag stays, since a key
 * turned on turns not null on with no action of its own.
 */
const startRelationshipActions = [
  addColumnAction,
  removeColumnAction,
  changeColumnNotNullAction,
  changeColumnPrimaryKeyAction,
  addRelationshipAction,
  removeRelationshipAction,
  changeRelationshipColumnsAction,
  addTableAction,
  removeTableAction,
  loadJsonAction,
  initialLoadJsonAction,
];

export const hooks: Hook[] = [
  [identificationActions, identificationHook],
  [startRelationshipActions, startRelationshipHook],
  [layoutActions, relationshipSortHook],
  [
    [...layoutActions, ...viewRowActions, ...viewLayoutActions],
    viewRelationshipSortHook,
  ],
];
