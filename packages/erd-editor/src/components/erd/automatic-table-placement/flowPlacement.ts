import {
  AppContext,
  appDestroy,
  createAppContext,
} from '@/components/appContext';
import { readerNameViewAction } from '@/components/erd/readerNameView';
import { TablePlacement } from '@/constants/tablePlacement';
import { initialLoadJsonAction$ } from '@/engine/modules/editor/generator.actions';
import {
  createElkLayoutRequest,
  type ElkLayoutPoint,
  type ElkLayoutRequest,
  toViewPoints,
} from '@/services/elk-layout';

import { layoutByElk } from './elkPlacement';

/**
 * What a Flow placement of a document asks ELK, measured in the reader's name
 * view on a plain store of its own with the editor's text measure, so nothing
 * reaches the editor's store. Null under two tables or with no relationship, the grid's cases.
 *
 * @example
 * const request = createFlowRequest(app, json);
 */
export function createFlowRequest(
  { toWidth, store }: AppContext,
  json: string
): ElkLayoutRequest | null {
  const scratch = createAppContext(
    { toWidth },
    { devtools: false, observable: false }
  );

  try {
    scratch.store.dispatchSync(
      initialLoadJsonAction$(json),
      readerNameViewAction(scratch.store.state, store.state)
    );

    const { doc } = scratch.store.state;
    if (doc.tableIds.length < 2 || !doc.relationshipIds.length) return null;

    return createElkLayoutRequest(scratch.store.state, TablePlacement.flow);
  } finally {
    appDestroy(scratch);
  }
}

/**
 * Where each table of a document not loaded yet goes by Flow, measured from
 * the corner of the block the tables make, so the caller decides where that
 * block stands. Null leaves the tables to the grid, and says nothing of why.
 *
 * @example
 * const points = await placeByFlow(app, json, controller.signal);
 */
export async function placeByFlow(
  app: AppContext,
  json: string,
  signal?: AbortSignal
): Promise<ElkLayoutPoint[] | null> {
  const request = createFlowRequest(app, json);
  if (!request) return null;

  // Nobody asked to watch this one, so the toast waits until the wait is
  // long enough to be worth a Cancel.
  const answer = await layoutByElk(app, request, { whenSlow: true, signal });

  return answer.status === 'placed'
    ? toViewPoints(request, answer.points)
    : null;
}
