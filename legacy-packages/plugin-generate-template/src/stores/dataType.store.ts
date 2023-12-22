import { makeAutoObservable } from 'mobx';
import { Subject } from 'rxjs';

import { orderByNameASC, uuid } from '@/core/helper';
import { DataType } from '@/core/indexedDB';
import { dataTypes as defaultDataTypes } from '@/data/defaultDataTypes';

export class DataTypeStore {
  dataTypes: DataType[] = [];
  eventBus: Subject<any>;

  constructor(eventBus: Subject<any>) {
    this.eventBus = eventBus;
    makeAutoObservable(this);
  }

  setDataTypes(dataTypes: DataType[]) {
    this.dataTypes = dataTypes;
    this.sort();
  }

  create(data: Pick<DataType, 'name' | 'primitiveType'>) {
    this.dataTypes.push({
      ...data,
      uuid: uuid(),
      updatedAt: Date.now(),
      createdAt: Date.now(),
    });
    this.eventBus.next('DataTypeStore.create');
  }

  update(data: Pick<DataType, 'name' | 'primitiveType' | 'uuid'>) {
    const dataType = this.dataTypes.find(
      dataType => dataType.uuid === data.uuid
    );
    if (!dataType) return;

    dataType.name = data.name;
    dataType.primitiveType = data.primitiveType;
    dataType.updatedAt = Date.now();
    this.eventBus.next('DataTypeStore.update');
  }

  delete(uuid: string) {
    this.setDataTypes(
      this.dataTypes.filter(dataType => dataType.uuid !== uuid)
    );
    this.eventBus.next('DataTypeStore.delete');
  }

  fetch(dataTypes: DataType[]) {
    if (dataTypes.length) {
      this.setDataTypes(dataTypes);
    } else {
      defaultDataTypes.forEach(data => this.create(data));
    }
  }

  sort() {
    this.dataTypes.sort(orderByNameASC);
  }
}
