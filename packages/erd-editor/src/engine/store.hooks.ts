import { cancel, type Channel, channel, go, put } from '@dineug/go';
import { type AnyAction } from '@dineug/r-html';
import { isString } from '@dineug/shared';

import { hooks as tableColumnHooks } from '@/engine/modules/tableColumn/hooks';
import type { Store } from '@/engine/store';

type Task = {
  pattern: Array<string>;
  channel: Channel<AnyAction>;
  proc: Promise<any>;
};

const hooks = [...tableColumnHooks];

export function createHooks(store: Store) {
  const tasks: Task[] = hooks.map(([pattern, hook]) => {
    const ch = channel();

    return {
      pattern: pattern.map(v => (isString(v) ? v : v.type)),
      channel: ch,
      proc: go(hook, ch, store.state, store.context),
    };
  });

  const unsubscribe = store.subscribe(actions => {
    for (const action of actions) {
      for (const task of tasks) {
        if (task.pattern.includes(action.type)) {
          put(task.channel, action);
        }
      }
    }
  });

  const destroy = () => {
    tasks.forEach(({ proc }) => cancel(proc));
    unsubscribe();
  };

  return { destroy };
}
