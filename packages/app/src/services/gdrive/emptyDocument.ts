import { createReplicationStore } from '@dineug/erd-editor/engine.js';

import { toWidth } from '@/utils/text';

/**
 * A new Drive file's content: the document an empty editor saves, read off a
 * headless replica the way the schema service makes one, then let go.
 */
export function createEmptyDocument(): string {
  const store = createReplicationStore({ toWidth });
  try {
    return store.value;
  } finally {
    store.destroy();
  }
}
