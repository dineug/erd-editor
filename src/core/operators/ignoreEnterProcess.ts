import { Observable } from 'rxjs';
import { groupBy, mergeMap, filter, throttleTime } from 'rxjs/operators';

export const ignoreEnterProcess = (source$: Observable<KeyboardEvent>) =>
  new Observable<KeyboardEvent>(subscriber =>
    source$
      .pipe(
        groupBy(event => event.code === 'Enter'),
        mergeMap(group$ =>
          group$.key
            ? group$.pipe(
                filter(event => event.key !== 'Process'),
                throttleTime(100)
              )
            : group$
        )
      )
      .subscribe(subscriber)
  );
