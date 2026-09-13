import type { AppContext } from '@/components/appContext';
import { ViewKind } from '@/engine/modules/editor/state';
import { viewSetCentersAction } from '@/engine/modules/editor/view.actions';

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
