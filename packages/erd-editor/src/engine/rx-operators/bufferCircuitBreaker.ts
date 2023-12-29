import { AnyAction } from '@dineug/r-html';
import { buffer, map, Observable } from 'rxjs';

import { notEmptyActions } from '@/engine/rx-operators/notEmptyActions';

export const bufferCircuitBreaker = (
  openingNotifier$: Observable<any>,
  closingNotifier$: Observable<any>
) => {
  return (source$: Observable<Array<AnyAction>>) =>
    source$.pipe(
      buffer(
        new Observable(subscriber => {
          let isConnection = false;

          const subscription = source$.subscribe(() => {
            isConnection && subscriber.next();
          });

          subscription.add(
            openingNotifier$.subscribe(() => {
              if (isConnection) return;

              isConnection = true;
              subscriber.next();
            })
          );

          subscription.add(
            closingNotifier$.subscribe(() => {
              isConnection = false;
            })
          );

          return subscription;
        })
      ),
      map(actions => actions.flat()),
      notEmptyActions
    );
};
