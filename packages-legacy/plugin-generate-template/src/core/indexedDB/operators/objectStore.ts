import { Observable } from 'rxjs';

import { Mode, Store } from '@/core/indexedDB';

export const objectStore =
  (store: Store, mode: Mode) => (source$: Observable<IDBDatabase>) =>
    new Observable<IDBObjectStore>(subscriber =>
      source$.subscribe({
        next(db) {
          const tx = db.transaction(store, mode);
          tx.oncomplete = () => subscriber.complete();

          subscriber.next(tx.objectStore(store));
        },
        error: e => subscriber.error(e),
        complete: () => subscriber.complete(),
      })
    );
