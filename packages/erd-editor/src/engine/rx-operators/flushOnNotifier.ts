import { map, Observable, switchMap, take } from 'rxjs';

import type { StreamBufferOperator } from '@/engine/rx-operators/groupByStreamActions';

/**
 * Closes a stream buffer when the notifier fires instead of after a quiet
 * period. A group arms only once it holds a value, so a tick with nothing
 * pending emits nothing and an extra tick is harmless.
 */
export const flushOnNotifier =
  (notifier$: Observable<unknown>): StreamBufferOperator =>
  source$ =>
    source$.pipe(
      switchMap(actions =>
        notifier$.pipe(
          take(1),
          map(() => actions)
        )
      )
    );
