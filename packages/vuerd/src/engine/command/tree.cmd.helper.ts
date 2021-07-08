import { uuid } from '@/core/helper';
import { Store } from '@@types/engine/store';

import { createCommand } from './helper';

export * from './table.cmd.helper.gen';

export function refreshTree(store: Store) {
  return createCommand('tree.refresh', {
    id: uuid(),
  });
}

export function hideTree(store: Store) {
  store.dispatchSync(refreshTree(store));

  return createCommand('tree.hide', {
    id: uuid(),
  });
}
