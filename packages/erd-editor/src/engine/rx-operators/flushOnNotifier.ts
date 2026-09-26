import { map, Observable, race, switchMap, take, timer } from 'rxjs';

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

/**
 * Closes a stream buffer after groupByStreamActions' 200 ms quiet period, or
 * at once when the notifier fires: the editor keeps its timing, and a host
 * can still send what is held before it lets the store go.
 */
export const quietPeriodOrNotifier =
  (notifier$: Observable<unknown>, quietMs = 200): StreamBufferOperator =>
  source$ =>
    source$.pipe(
      switchMap(actions =>
        race(timer(quietMs), notifier$.pipe(take(1))).pipe(map(() => actions))
      )
    );
