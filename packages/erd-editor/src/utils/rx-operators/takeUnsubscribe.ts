import { Observable } from 'rxjs';

export const takeUnsubscribe =
  (callback: () => void) =>
  <T>(source$: Observable<T>) =>
    new Observable<T>(subscriber => {
      const subscription = source$.subscribe({
        next: value => subscriber.next(value),
        error: err => subscriber.error(err),
        complete: () => subscriber.complete(),
      });

      return () => {
        subscription.unsubscribe();
        callback();
      };
    });
