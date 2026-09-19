import { AnyAction } from '@dineug/r-html';
import { Observable } from 'rxjs';

/**
 * Holds the source's batches while the circuit is open, flushes them when it
 * closes and lets batches straight through until it opens again. The source is
 * subscribed once, so a cold upstream's timers cannot flush ahead of its value.
 */
export const bufferCircuitBreaker = (
  openingNotifier$: Observable<any>,
  closingNotifier$: Observable<any>
) => {
  return (source$: Observable<Array<AnyAction>>) =>
    new Observable<Array<AnyAction>>(subscriber => {
      let isConnection = false;
      let pending: Array<Array<AnyAction>> = [];

      const flush = () => {
        const actions = pending.flat();
        pending = [];
        actions.length && subscriber.next(actions);
      };

      const subscription = source$.subscribe({
        next: actions => {
          pending.push(actions);
          isConnection && flush();
        },
        error: error => subscriber.error(error),
        complete: () => {
          flush();
          subscriber.complete();
        },
      });

      subscription.add(
        openingNotifier$.subscribe(() => {
          if (isConnection) return;

          isConnection = true;
          flush();
        })
      );

      subscription.add(
        closingNotifier$.subscribe(() => {
          isConnection = false;
        })
      );

      return subscription;
    });
};
