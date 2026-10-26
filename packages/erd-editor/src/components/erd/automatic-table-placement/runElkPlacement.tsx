import { AppContext } from '@/components/appContext';
import { localized } from '@/components/localized/Localized';
import { openStatusToast } from '@/components/toast-container/openStatusToast';
import {
  createElkLayoutRequest,
  type ElkLayoutPoint,
  type ElkPlacement,
  toTablePoints,
} from '@/services/elk-layout';

import { layoutByElk, type LayoutByElkOptions } from './elkPlacement';

/**
 * Places every table by ELK and hands the layout straight over. No preview
 * overlay: one layout arrives at once, there is nothing to weigh before it
 * lands, and a single undo puts every table back.
 *
 * @example
 * runElkPlacement(app.value, placement, handleChange, { signal });
 */
export async function runElkPlacement(
  app: AppContext,
  placement: ElkPlacement,
  onChange: (tables: ElkLayoutPoint[]) => void,
  { signal }: Pick<LayoutByElkOptions, 'signal'> = {}
): Promise<void> {
  const { store, emitter } = app;
  const request = createElkLayoutRequest(store.state, placement);

  if (!request.nodes.length) {
    openStatusToast(emitter, {
      key: 'common.toast.noTablesToPlace',
      title: localized('common.toast.noTablesToPlace'),
    });
    return;
  }

  const answer = await layoutByElk(app, request, { signal });

  // A large schema can outlast the patience of whoever asked for it, and a
  // layout nobody is waiting for any more is dropped rather than applied.
  if (answer.status === 'placed') {
    onChange(toTablePoints(store.state, request, answer.points));
    return;
  }
  if (answer.status === 'cancelled') return;

  console.warn('[automatic-table-placement] no layout came back', answer.error);
  openStatusToast(emitter, {
    key: 'common.toast.couldNotPlaceTables',
    tone: 'error',
    title: localized('common.toast.couldNotPlaceTables'),
  });
}
