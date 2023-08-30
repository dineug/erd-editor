import { cancel, type Channel, channel, go, put } from '@dineug/go';
import { type AnyAction } from '@dineug/r-html';
import { arrayHas } from '@dineug/shared';

import { hooks as relationshipHooks } from '@/engine/modules/relationship/hooks';
import type { Store } from '@/engine/store';

type Task = {
  pattern: ReturnType<typeof arrayHas<string>>;
  channel: Channel<AnyAction>;
  proc: Promise<any>;
};

const hooks = [...relationshipHooks];

export function createHooks(store: Store) {
  const tasks: Task[] = hooks.map(([pattern, hook]) => {
    const ch = channel();

    return {
      pattern: arrayHas(pattern.map(String)),
      channel: ch,
      proc: go(hook, ch, store.state, store.context),
    };
  });

  const unsubscribe = store.subscribe(actions => {
    for (const action of actions) {
      for (const task of tasks) {
        if (task.pattern(action.type)) {
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
