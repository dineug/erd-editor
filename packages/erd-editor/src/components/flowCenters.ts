import type { AppContext } from '@/components/appContext';
import { CenterStep, ViewKind } from '@/engine/modules/editor/state';
import { toSteppedCenters } from '@/engine/modules/editor/view';
import {
  viewSetCentersAction,
  viewStepCentersAction,
} from '@/engine/modules/editor/view.actions';

/**
 * Narrows the Flow view to the tables given and their one hop. State alone:
 * the placement loop reads the display set it names and asks for the layout,
 * so this and the mount never hold two answers to the one question.
 */
export function focusFlowView(app: AppContext, tableIds: string[]): void {
  app.store.dispatchSync(
    viewSetCentersAction({ tableIds, kind: ViewKind.flow })
  );
}

/** Widens the Flow view back to everything it placed, through that same one channel: state alone. */
export function showAllFlowView(app: AppContext): void {
  focusFlowView(app, []);
}

/**
 * Stands the Flow view on the centers a step the way given reaches, through that
 * same one channel: state alone. With nowhere to go it dispatches nothing, so a
 * dimmed button or a chord pressed again wakes no sort and drops no set.
 */
export function stepFlowView(app: AppContext, step: CenterStep): void {
  if (!canStepFlowView(app, step)) return;

  app.store.dispatchSync(viewStepCentersAction({ step, kind: ViewKind.flow }));
}

/** Whether a step the way given would move the Flow view, past the sets it would pass over. */
export function canStepFlowView(app: AppContext, step: CenterStep): boolean {
  const { state } = app.store;
  const view = state.editor.views.flow;
  if (!view) return false;

  const tableIds = new Set(state.doc.tableIds);
  const trail =
    step === CenterStep.previous ? view.previousCenterIds : view.nextCenterIds;
  return trail.some(ids => toSteppedCenters(tableIds, view, ids) !== null);
}
