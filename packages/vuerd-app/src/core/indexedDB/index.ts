import pick from 'lodash/pick';
import { Observable } from 'rxjs';

import { findOne } from '@/core/indexedDB/operators/findOne';
import { objectStore } from '@/core/indexedDB/operators/objectStore';
import { TreeNode, TreeNodeType } from '@/store/tree';

export type Mode = 'readwrite' | 'readonly';
export type Store = 'tree';

export class Node {
  name = '';
  open = false;
  value = '';
  type = TreeNodeType.folder;
  children: Node[] = [];

  constructor(node: TreeNode) {
    Object.assign(this, pick(node, ['name', 'open', 'value', 'type']));
    this.children = node.children.map(childNode => new Node(childNode));
  }
}

export const DB = {
  name: '@vuerd/app',
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
    db.createObjectStore('tree', { keyPath: 'name' });
  };

  return () => openDB.result?.close();
});

export const findOenNode = new Observable<Node | undefined>(subscriber =>
  openIndexedDB.pipe(findOne<Node>('root', 'tree', DB.mode.R)).subscribe({
    next([prev, store]) {
      subscriber.next(prev);
      subscriber.complete();
    },
    error: e => subscriber.error(e),
    complete: () => subscriber.complete(),
  })
);

export const createNode = (treeNode: TreeNode) =>
  new Observable<IDBValidKey>(subscriber =>
    openIndexedDB.pipe(objectStore('tree', DB.mode.RW)).subscribe({
      next(store) {
        const req = store.add(new Node(treeNode));

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

export const updateNode = (treeNode: TreeNode) =>
  new Observable<IDBValidKey>(subscriber =>
    openIndexedDB.pipe(findOne<Node>('root', 'tree', DB.mode.RW)).subscribe({
      next([prev, store]) {
        const req = store.put(new Node(treeNode));

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

export const createAndUpdateNode = (treeNode: TreeNode) =>
  new Observable<IDBValidKey>(subscriber =>
    openIndexedDB.pipe(findOne<Node>('root', 'tree', DB.mode.RW)).subscribe({
      next([prev, store]) {
        const node = new Node(treeNode);
        const req = prev ? store.put(node) : store.add(node);

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
