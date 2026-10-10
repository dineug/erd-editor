import { query } from '@dineug/erd-editor-schema';
import { observable } from '@dineug/r-html';

import type { AppContext } from '@/components/appContext';
import { SCHEMA_SQL_PANEL_COLLAPSE_BELOW } from '@/constants/layout';
import { CanvasType } from '@/constants/schema';
import { changeCanvasTypeAction } from '@/engine/modules/settings/atom.actions';
import type { RxStore } from '@/engine/rx-store';
import type { RootState } from '@/engine/state';
import { SchemaSQLHeader, SchemaSQLStatements } from '@/utils/schema-sql';
import { getTableGroupId } from '@/utils/tableGroup';

/** Whether an options panel shows: unset until the editor is first measured. */
export type OptionsPanelState = 'unset' | 'open' | 'closed';

/** Where a tab keeps its options panel's place, the Code Generator's as this one's. */
export type PanelView = { panel: OptionsPanelState };

/** Which tables the DDL writes, by the table group they are in. */
export type SchemaSQLTableChoice = {
  /** Each table group checked or not, by id. */
  groups: Readonly<Record<string, boolean>>;
  /** Whether the tables in no group are checked. */
  noGroup: boolean;
};

export type SchemaSQLView = {
  /** The statements asked for, which each database resolves to what it has. */
  statements: SchemaSQLStatements;
  /** The header asked for, resolved the same way. */
  header: SchemaSQLHeader;
  /** Replaced whole, never changed in place, so a watcher hears one change. */
  tables: SchemaSQLTableChoice;
  panel: OptionsPanelState;
  /** Set by the export path, spent by the panel on the Save file button. */
  focusSave: boolean;
};

const views = new WeakMap<RxStore, SchemaSQLView>();

/**
 * The window's own Schema SQL choices: never in the store, the file or a
 * change event, kept until the element goes, one set per editor.
 */
export function schemaSQLViewOf({
  store,
}: Pick<AppContext, 'store'>): SchemaSQLView {
  let view = views.get(store);

  if (!view) {
    view = observable<SchemaSQLView>({
      statements: SchemaSQLStatements.ifNotExists,
      header: SchemaSQLHeader.createAndUse,
      tables: { groups: {}, noGroup: true },
      panel: 'unset',
      focusSave: false,
    });
    views.set(store, view);
  }

  return view;
}

/**
 * Whether the panel shows: an unset panel opens on an editor 640px wide or
 * more, once it is measured, and keeps that whatever the width does next.
 */
export function resolvePanel(
  view: PanelView,
  editorWidth: number
): 'open' | 'closed' | 'unknown' {
  if (view.panel !== 'unset') return view.panel;
  if (editorWidth <= 0) return 'unknown';

  view.panel =
    editorWidth < SCHEMA_SQL_PANEL_COLLAPSE_BELOW ? 'closed' : 'open';
  return view.panel;
}

/** Folds a panel away or opens it; one not measured yet opens. */
export function togglePanel(view: PanelView, editorWidth: number) {
  const panel = resolvePanel(view, editorWidth);

  view.panel = panel === 'open' ? 'closed' : 'open';
}

/** Folds the Schema SQL panel away or opens it. */
export function toggleSchemaSQLPanel(app: Pick<AppContext, 'store'>) {
  togglePanel(schemaSQLViewOf(app), app.store.state.editor.viewport.width);
}

/** The Schema SQL tab with its panel open and Save file focused, which saves nothing yet. */
export function showSchemaSQLExport(app: Pick<AppContext, 'store'>) {
  const { store } = app;
  const view = schemaSQLViewOf(app);

  view.panel = 'open';
  view.focusSave = true;

  if (store.state.settings.canvasType !== CanvasType.schemaSQL) {
    store.dispatch(changeCanvasTypeAction({ value: CanvasType.schemaSQL }));
  }
}

/** Whether every group the choice holds and the tables in none are checked. */
export function isEveryTableChosen({ groups, noGroup }: SchemaSQLTableChoice) {
  return noGroup && Object.values(groups).every(Boolean);
}

/**
 * The choice over the groups the document lists, in its order: a group it has
 * not met starts checked only while every box was, and one no longer listed
 * is dropped; with no group listed, every box is checked again.
 */
export function resolveTableChoice(
  choice: SchemaSQLTableChoice,
  groupIds: ReadonlyArray<string>
): SchemaSQLTableChoice {
  if (!groupIds.length) return { groups: {}, noGroup: true };

  const fresh = isEveryTableChosen(choice);
  const groups: Record<string, boolean> = {};

  for (const id of groupIds) {
    groups[id] = Object.hasOwn(choice.groups, id) ? choice.groups[id] : fresh;
  }

  return { groups, noGroup: choice.noGroup };
}

function isSameChoice(a: SchemaSQLTableChoice, b: SchemaSQLTableChoice) {
  const ids = Object.keys(a.groups);

  return (
    a.noGroup === b.noGroup &&
    ids.length === Object.keys(b.groups).length &&
    ids.every(
      id => Object.hasOwn(b.groups, id) && a.groups[id] === b.groups[id]
    )
  );
}

/**
 * Matches the choice to the document's groups as they change, so a group added
 * later starts as every box was then; it writes only a choice that moved.
 */
export function syncTableChoice(
  view: SchemaSQLView,
  groupIds: ReadonlyArray<string>
) {
  const next = resolveTableChoice(view.tables, groupIds);
  if (!isSameChoice(view.tables, next)) view.tables = next;
}

/** Checks or unchecks every box. */
export function chooseAllTables(
  view: SchemaSQLView,
  groupIds: ReadonlyArray<string>,
  checked: boolean
) {
  view.tables = {
    groups: Object.fromEntries(groupIds.map(id => [id, checked])),
    noGroup: checked,
  };
}

/** Checks or unchecks one group, every other box as it reads. */
export function chooseTableGroup(
  view: SchemaSQLView,
  groupIds: ReadonlyArray<string>,
  groupId: string,
  checked: boolean
) {
  const { groups, noGroup } = resolveTableChoice(view.tables, groupIds);
  view.tables = { groups: { ...groups, [groupId]: checked }, noGroup };
}

/** Checks or unchecks the tables in no group, every other box as it reads. */
export function chooseNoGroup(
  view: SchemaSQLView,
  groupIds: ReadonlyArray<string>,
  checked: boolean
) {
  const { groups } = resolveTableChoice(view.tables, groupIds);
  view.tables = { groups, noGroup: checked };
}

/** Whether no box is checked while the document has a group, which writes nothing. */
export function isNoTableChosen(
  choice: SchemaSQLTableChoice,
  groupIds: ReadonlyArray<string>
) {
  const { groups, noGroup } = resolveTableChoice(choice, groupIds);
  return !noGroup && !Object.values(groups).some(Boolean);
}

/**
 * The ids of the tables the checked boxes hold, in document order, or
 * undefined for the whole document, while every box is checked or the
 * document has no group; a table's group reads as getTableGroupId reads it.
 */
export function chosenTableIds(
  state: RootState,
  choice: SchemaSQLTableChoice
): string[] | undefined {
  const { doc, collections } = state;
  const resolved = resolveTableChoice(choice, doc.tableGroupIds);
  if (isEveryTableChosen(resolved)) return undefined;

  return query(collections)
    .collection('tableEntities')
    .selectByIds(doc.tableIds)
    .filter(table => {
      const groupId = getTableGroupId(state, table);
      return groupId ? resolved.groups[groupId] : resolved.noGroup;
    })
    .map(({ id }) => id);
}
