import { DateTime } from 'luxon';

import { Collections, GetEntities, GetEntity } from '@/internal-types';

class Query {
  constructor(private readonly collections: Collections) {}

  collection<K extends keyof Collections>(collection: K) {
    return new CollectionQuery<K>(this.collections[collection]);
  }
}

class CollectionQuery<K extends keyof Collections> {
  constructor(private collection: GetEntities<K>) {}

  selectById(id: string): GetEntity<K> | undefined {
    return this.collection[id] as GetEntity<K> | undefined;
  }
  selectByIds(ids: string[]): Array<GetEntity<K>> {
    return ids.map(id => this.selectById(id)).filter(Boolean) as Array<
      GetEntity<K>
    >;
  }
  selectEntities(): GetEntities<K> {
    return this.collection;
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
      delete this.collection[id];
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
      entity.meta.updateAt = DateTime.now().toISO() ?? '';
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

  incrementDeleted(id: string, recipe: (deleted: number) => void) {
    const entity = this.selectById(id);
    if (entity) {
      entity.meta.deleted++;
      if (entity.meta.deleted >= 0) {
        recipe(entity.meta.deleted);
      }
    }
    return this;
  }

  decrementDeleted(id: string, recipe: (deleted: number) => void) {
    const entity = this.selectById(id);
    if (entity) {
      entity.meta.deleted--;
      if (entity.meta.deleted < 0) {
        recipe(entity.meta.deleted);
      }
    }
    return this;
  }
}

export const query = (collections: Collections) => new Query(collections);
