import { asapScheduler, observeOn, throttleTime } from 'rxjs';

import type { Hook, HookEffect } from '@/engine/hooks';
import {
  initialLoadJsonAction,
  loadJsonAction,
} from '@/engine/modules/editor/atom.actions';
import { removeTableAction } from '@/engine/modules/table/atom.actions';
import { recalculateTableWidth } from '@/utils/calcTable';
import { relationshipSort } from '@/utils/draw-relationship/sort';

const recalculateTableWidthHook: HookEffect = (action$, getState, ctx) =>
  action$
    .pipe(throttleTime(5, undefined, { leading: false, trailing: true }))
    .subscribe(() => {
      const state = getState();
      recalculateTableWidth(state, ctx);
      relationshipSort(state);
    });

/**
 * Ends a relationship draw once the table it starts from is removed, by a key,
 * a button or a peer. Left armed, it would close on a table no longer there.
 */
const endDrawFromRemovedTableHook: HookEffect = (action$, getState) =>
  action$.pipe(observeOn(asapScheduler)).subscribe(() => {
    const { doc, editor } = getState();
    const start = editor.drawRelationship?.start;
    if (!start || doc.tableIds.includes(start.tableId)) return;

    editor.drawRelationship = null;
  });

export const hooks: Hook[] = [
  [[loadJsonAction, initialLoadJsonAction], recalculateTableWidthHook],
  [[removeTableAction], endDrawFromRemovedTableHook],
];
