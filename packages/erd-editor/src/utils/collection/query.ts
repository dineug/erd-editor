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
  }
  setMany(entities: Array<GetEntity<K>>) {
    entities.forEach(entity => this.setOne(entity));
  }
  setAll(entities: Array<GetEntity<K>>) {
    this.removeAll();
    this.setMany(entities);
  }

  addOne(entity: GetEntity<K>) {
    const prev = this.selectById(entity.id);
    if (prev) return;

    this.setOne(entity);
  }
  addMany(entities: Array<GetEntity<K>>) {
    entities.forEach(entity => this.addOne(entity));
  }

  removeOne(id: string) {
    if (this.selectById(id)) {
      delete this.collection[id];
    }
  }
  removeMany(ids: string[]) {
    ids.forEach(id => this.removeOne(id));
  }
  removeAll() {
    this.collection = {};
  }

  updateOne(id: string, recipe: (entity: GetEntity<K>) => void) {
    const entity = this.selectById(id);
    if (entity) {
      recipe(entity);
      entity.meta.updateAt = DateTime.now().toISO() ?? '';
    }
  }
  updateMany(ids: string[], recipe: (entity: GetEntity<K>) => void) {
    ids.forEach(id => this.updateOne(id, recipe));
  }
}

export const query = (collections: Collections) => new Query(collections);
