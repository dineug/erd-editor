import { Observable } from 'rxjs';

import { DB, Store } from '@/core/indexedDB';
import { objectStore } from '@/core/indexedDB/operators/objectStore';

export const findAll =
  <T>(store: Store) =>
  (source$: Observable<IDBDatabase>) =>
    new Observable<Array<T>>(subscriber =>
      source$.pipe(objectStore(store, DB.mode.R)).subscribe({
        next(store) {
          const list: Array<T> = [];
          const req = store.openCursor();

          req.onsuccess = (event: any) => {
            const cursor: IDBCursorWithValue | null = event.target.result;

            if (cursor) {
              const req = store.get(cursor.key);
              req.onsuccess = (event: any) => list.push(event.target.result);
              cursor.continue();
            } else {
              subscriber.next(list);
              subscriber.complete();
            }
          };
          req.onerror = e => subscriber.error(e);
        },
        error: e => subscriber.error(e),
        complete: () => subscriber.complete(),
      })
    );
