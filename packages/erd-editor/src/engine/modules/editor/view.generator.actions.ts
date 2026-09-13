import { CanvasType } from '@/constants/schema';
import { GeneratorAction } from '@/engine/generator.actions';
import { changeCanvasTypeAction } from '@/engine/modules/settings/atom.actions';

import { SelectType, ViewKind, VisualizationMode } from './state';
import {
  changeVisualizationModeAction,
  viewOpenAction,
  viewSetCentersAction,
} from './view.actions';

/** The slot this action names, so it never reads the active view. */
const FLOW = ViewKind.flow;

/**
 * The centers a focus from the ERD takes: every table the selection holds, and
 * the one a menu was raised over alone when the selection does not hold it, so
 * a group is focused as one exactly as it is dragged as one. A memo is no center.
 *
 * @example
 * store.dispatch(focusFlowTableAction$(focusCentersOf(editor.selectedMap, tableId)));
 */
export function focusCentersOf(
  selectedMap: Record<string, SelectType>,
  tableId?: string
): string[] {
  if (tableId && selectedMap[tableId] !== SelectType.table) return [tableId];

  return Object.entries(selectedMap)
    .filter(([, selectType]) => selectType === SelectType.table)
    .map(([id]) => id);
}

/**
 * Stands the reader on the tables given in the Flow view: the visualization
 * tab comes up on Flow, a view is opened if none is, and what it shows narrows
 * to those centers and their neighbours. No ids and it stands.
 *
 * @example
 * store.dispatch(focusFlowTableAction$(['orders']));
 */
export const focusFlowTableAction$ = (tableIds: string[]): GeneratorAction =>
  function* ({ editor, settings }) {
    if (!tableIds.length) return;

    if (settings.canvasType !== CanvasType.visualization) {
      yield changeCanvasTypeAction({ value: CanvasType.visualization });
    }

    if (editor.visualizationMode !== VisualizationMode.flow) {
      yield changeVisualizationModeAction({ value: VisualizationMode.flow });
    }

    // A view opened on centers seeds the key rows, which a view already
    // standing on the whole document has already answered for itself.
    yield editor.views.flow
      ? viewSetCentersAction({ tableIds, kind: FLOW })
      : viewOpenAction({ kind: FLOW, centerIds: tableIds });
  };

export const viewActions$ = {
  focusFlowTableAction$,
};
