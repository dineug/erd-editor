import { Observable } from 'rxjs';

import { uuid } from '@/core/helper';
import { findAll } from '@/core/indexedDB/operators/findAll';
import { findOne } from '@/core/indexedDB/operators/findOne';
import { objectStore } from '@/core/indexedDB/operators/objectStore';

export type Mode = 'readwrite' | 'readonly';
export type Store = 'template' | 'dataType';

export interface Template {
  uuid: string;
  name: string;
  value: string;
  updatedAt: number;
  createdAt: number;
}

export interface DataType {
  uuid: string;
  name: string;
  primitiveType: string;
  updatedAt: number;
  createdAt: number;
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
    db.createObjectStore('template', { keyPath: 'uuid' });
    db.createObjectStore('dataType', { keyPath: 'uuid' });
  };

  return () => openDB.result?.close();
});

export const findTemplates = openIndexedDB.pipe(findAll<Template>('template'));

export const createTemplate = (data: Pick<Template, 'name' | 'value'>) =>
  new Observable<IDBValidKey>(subscriber =>
    openIndexedDB.pipe(objectStore('template', DB.mode.RW)).subscribe({
      next(store) {
        const req = store.add({
          ...data,
          uuid: uuid(),
          updatedAt: Date.now(),
          createdAt: Date.now(),
        });

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

export const updateByTemplateUUID = (
  data: Pick<Template, 'name' | 'value' | 'uuid'>
) =>
  new Observable<IDBValidKey>(subscriber =>
    openIndexedDB
      .pipe(findOne<Template>(data.uuid, 'template', DB.mode.RW))
      .subscribe({
        next([prev, store]) {
          const req = store.put({ ...prev, ...data, updatedAt: Date.now() });

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

export const deleteByTemplateUUID = (uuid: string) =>
  new Observable<Template>(subscriber =>
    openIndexedDB
      .pipe(findOne<Template>(uuid, 'template', DB.mode.RW))
      .subscribe({
        next([data, store]) {
          const req = store.delete(uuid);

          req.onsuccess = () => {
            subscriber.next(data);
            subscriber.complete();
          };
          req.onerror = e => subscriber.error(e);
        },
        error: e => subscriber.error(e),
        complete: () => subscriber.complete(),
      })
  );

export const findDataTypes = openIndexedDB.pipe(findAll<DataType>('dataType'));

export const createDataType = (
  data: Pick<DataType, 'name' | 'primitiveType'>
) =>
  new Observable<IDBValidKey>(subscriber =>
    openIndexedDB.pipe(objectStore('dataType', DB.mode.RW)).subscribe({
      next(store) {
        const req = store.add({
          ...data,
          uuid: uuid(),
          updatedAt: Date.now(),
          createdAt: Date.now(),
        });

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

export const updateByDataTypeUUID = (
  data: Pick<DataType, 'name' | 'primitiveType' | 'uuid'>
) =>
  new Observable<IDBValidKey>(subscriber =>
    openIndexedDB
      .pipe(findOne<DataType>(data.uuid, 'dataType', DB.mode.RW))
      .subscribe({
        next([prev, store]) {
          const req = store.put({ ...prev, ...data, updatedAt: Date.now() });

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

export const deleteByDataTypeUUID = (uuid: string) =>
  new Observable<DataType>(subscriber =>
    openIndexedDB
      .pipe(findOne<DataType>(uuid, 'dataType', DB.mode.RW))
      .subscribe({
        next([data, store]) {
          const req = store.delete(uuid);

          req.onsuccess = () => {
            subscriber.next(data);
            subscriber.complete();
          };
          req.onerror = e => subscriber.error(e);
        },
        error: e => subscriber.error(e),
        complete: () => subscriber.complete(),
      })
  );
