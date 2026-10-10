import { observable } from '@dineug/r-html';

import type { AppContext } from '@/components/appContext';
import { SCHEMA_SQL_PANEL_COLLAPSE_BELOW } from '@/constants/layout';
import { CanvasType } from '@/constants/schema';
import { changeCanvasTypeAction } from '@/engine/modules/settings/atom.actions';
import type { RxStore } from '@/engine/rx-store';
import { SchemaSQLHeader, SchemaSQLStatements } from '@/utils/schema-sql';

/** Whether an options panel shows: unset until the editor is first measured. */
export type OptionsPanelState = 'unset' | 'open' | 'closed';

/** Where a tab keeps its options panel's place, the Code Generator's as this one's. */
export type PanelView = { panel: OptionsPanelState };

export type SchemaSQLView = {
  /** The statements asked for, which each database resolves to what it has. */
  statements: SchemaSQLStatements;
  /** The header asked for, resolved the same way. */
  header: SchemaSQLHeader;
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
