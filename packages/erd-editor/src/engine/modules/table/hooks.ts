import { asapScheduler, observeOn } from 'rxjs';

import type { Hook, HookEffect } from '@/engine/hooks';
import { removeTableAction } from '@/engine/modules/table/atom.actions';

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
  [[removeTableAction], endDrawFromRemovedTableHook],
];
