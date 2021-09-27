import { Observable } from 'rxjs';

import { DB, Mode, Store } from '@/core/indexedDB';
import { objectStore } from '@/core/indexedDB/operators/objectStore';

type DataTuple<T> = [T | undefined, IDBObjectStore];

export const findOne =
  <T = any>(
    id: string | IDBValidKey,
    storeName: Store,
    mode: Mode = DB.mode.R
  ) =>
  (source$: Observable<IDBDatabase>) =>
    new Observable<DataTuple<T>>(subscriber =>
      source$.pipe(objectStore(storeName, mode)).subscribe({
        next(store) {
          const req: IDBRequest<T> = store.get(id);

          req.onsuccess = () => subscriber.next([req.result, store]);
          req.onerror = e => subscriber.error(e);
        },
        error: e => subscriber.error(e),
        complete: () => subscriber.complete(),
      })
    );
