import { Observable } from 'rxjs';

import { DB, Mode, Store } from '@/core/indexedDB';
import { objectStore } from '@/core/indexedDB/operators/objectStore';

export const findAll =
  <T = any>(storeName: Store, mode: Mode = DB.mode.R) =>
  (source$: Observable<IDBDatabase>) =>
    new Observable<Array<T>>(subscriber =>
      source$.pipe(objectStore(storeName, mode)).subscribe({
        next(store) {
          const list: Array<T> = [];
          const cursorReq = store.openCursor();

          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;

            if (cursor) {
              const req = store.get(cursor.key);
              req.onsuccess = () => list.push(req.result);
              cursor.continue();
            } else {
              subscriber.next(list);
              subscriber.complete();
            }
          };
          cursorReq.onerror = e => subscriber.error(e);
        },
        error: e => subscriber.error(e),
        complete: () => subscriber.complete(),
      })
    );
