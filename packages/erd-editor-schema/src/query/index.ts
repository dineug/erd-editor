import { ERDEditorSchemaV3 } from '@/v3';
import { LWW } from '@/v3/schema/lww';

import { addOperator, removeOperator, replaceOperator } from './lww';

export type Collections = ERDEditorSchemaV3['collections'];

export type GetEntity<T extends keyof ERDEditorSchemaV3['collections']> =
  ERDEditorSchemaV3['collections'][T][keyof ERDEditorSchemaV3['collections'][T]];

export type GetEntities<T extends keyof ERDEditorSchemaV3['collections']> =
  ERDEditorSchemaV3['collections'][T];

class Query {
  constructor(private readonly collections: Collections) {}

  collection<K extends keyof Collections>(collection: K) {
    return new CollectionQuery<K>(this.collections[collection], collection);
  }
}

class CollectionQuery<K extends keyof Collections> {
  constructor(
    private collection: GetEntities<K>,
    private collectionKey: K
  ) {}

  selectById(id: string): GetEntity<K> | undefined {
    return this.collection[id] as GetEntity<K> | undefined;
  }
  selectByIds(ids: string[]): Array<GetEntity<K>> {
    ids.length; // observable dependency
    return ids.map(id => this.selectById(id)).filter(Boolean) as Array<
      GetEntity<K>
    >;
  }
  selectEntities(): GetEntities<K> {
    return this.collection;
  }
  selectAll(): Array<GetEntity<K>> {
    return Object.values(this.collection);
  }

  setOne(entity: GetEntity<K>) {
    this.collection[entity.id] = entity;
    return this;
  }
  setMany(entities: Array<GetEntity<K>>) {
    entities.forEach(entity => this.setOne(entity));
    return this;
  }
  setAll(entities: Array<GetEntity<K>>) {
    this.removeAll();
    this.setMany(entities);
    return this;
  }

  addOne(entity: GetEntity<K>) {
    const prev = this.selectById(entity.id);
    if (prev) return this;

    this.setOne(entity);
    return this;
  }
  addMany(entities: Array<GetEntity<K>>) {
    entities.forEach(entity => this.addOne(entity));
    return this;
  }

  removeOne(id: string) {
    if (this.selectById(id)) {
      Reflect.deleteProperty(this.collection, id);
    }
    return this;
  }
  removeMany(ids: string[]) {
    ids.forEach(id => this.removeOne(id));
    return this;
  }
  removeAll() {
    this.collection = {};
    return this;
  }

  updateOne(id: string, recipe: (entity: GetEntity<K>) => void) {
    const entity = this.selectById(id);
    if (entity) {
      recipe(entity);
      entity.meta.updateAt = Date.now();
    }
    return this;
  }
  updateMany(ids: string[], recipe: (entity: GetEntity<K>) => void) {
    ids.forEach(id => this.updateOne(id, recipe));
    return this;
  }

  getOrCreate(id: string, recipe: (id: string) => GetEntity<K>) {
    const entity = this.selectById(id);
    if (entity) return entity;

    const newEntity = recipe(id);
    this.setOne(newEntity);
    return this.selectById(id) as GetEntity<K>;
  }

  addOperator(lww: LWW, version: number, id: string, recipe: () => void) {
    addOperator(lww, version, id, this.collectionKey, recipe);
    return this;
  }

  removeOperator(lww: LWW, version: number, id: string, recipe: () => void) {
    removeOperator(lww, version, id, this.collectionKey, recipe);
    return this;
  }

  replaceOperator(
    lww: LWW,
    version: number,
    id: string,
    path: string,
    recipe: () => void
  ) {
    replaceOperator(lww, version, id, this.collectionKey, path, recipe);
    return this;
  }
}

export const query = (collections: Collections) => new Query(collections);
