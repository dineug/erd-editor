import { Observable } from 'rxjs';

import { findAll } from '@/core/indexedDB/operators/findAll';
import { objectStore } from '@/core/indexedDB/operators/objectStore';

export type Mode = 'readwrite' | 'readonly';
export type Store = 'template';

export interface Template {
  name: string;
  value: string;
}

export const DB = {
  name: '@vuerd/plugin-generate-template',
  version: 1,
  mode: {
    RW: 'readwrite' as Mode,
    R: 'readonly' as Mode,
  },
};

export const openIndexedDB = new Observable<IDBDatabase>(subscriber => {
  const openDB = indexedDB.open(DB.name, DB.version);

  openDB.onsuccess = () => subscriber.next(openDB.result);
  openDB.onerror = event => subscriber.error(event);
  openDB.onupgradeneeded = (event: any) => {
    const db = event.currentTarget.result;
    db.createObjectStore('template', { keyPath: 'name' });
  };

  return () => openDB.result?.close();
});

export const findTemplates = openIndexedDB.pipe(findAll<Template>('template'));

export const createTemplate = (data: Template) =>
  new Observable<IDBValidKey>(subscriber =>
    openIndexedDB.pipe(objectStore('template', DB.mode.RW)).subscribe({
      next(store) {
        const req = store.add(data);

        req.onsuccess = () => {
          subscriber.next(req.result);
          subscriber.complete();
        };
        req.onerror = e => subscriber.error(e);
      },
      error: e => subscriber.error(e),
      complete: () => subscriber.complete(),
    })
  );

export const updateByTemplateName = (data: Template) =>
  new Observable<IDBValidKey>(subscriber =>
    openIndexedDB.pipe(objectStore('template', DB.mode.RW)).subscribe({
      next(store) {
        const getReq: IDBRequest<Template> = store.get(data.name);
        const onError = (e: any) => subscriber.error(e);

        getReq.onsuccess = () => {
          const old = getReq.result;
          const req = store.put({ ...old, ...data });

          req.onsuccess = () => {
            subscriber.next(req.result);
            subscriber.complete();
          };
          req.onerror = onError;
        };
        getReq.onerror = onError;
      },
      error: e => subscriber.error(e),
      complete: () => subscriber.complete(),
    })
  );

export const deleteByTemplateName = (name: string) =>
  new Observable<Template>(subscriber =>
    openIndexedDB.pipe(objectStore('template', DB.mode.RW)).subscribe({
      next(store) {
        const getReq: IDBRequest<Template> = store.get(name);
        const onError = (e: any) => subscriber.error(e);

        getReq.onsuccess = () => {
          const req = store.delete(name);

          req.onsuccess = () => {
            subscriber.next(getReq.result);
            subscriber.complete();
          };
          req.onerror = onError;
        };
        getReq.onerror = onError;
      },
      error: e => subscriber.error(e),
      complete: () => subscriber.complete(),
    })
  );
