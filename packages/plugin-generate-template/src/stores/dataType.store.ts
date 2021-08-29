import { makeAutoObservable, runInAction } from 'mobx';

import { orderByNameASC } from '@/core/helper';
import {
  createDataType,
  DataType,
  deleteByDataTypeUUID,
  findDataTypes,
  openIndexedDB,
  updateByDataTypeUUID,
} from '@/core/indexedDB';
import { findOne } from '@/core/indexedDB/operators/findOne';
import { dataTypes as defaultDataTypes } from '@/data/defaultDataTypes';

export class DataTypeStore {
  dataTypes: DataType[] = [];

  constructor() {
    makeAutoObservable(this);
  }

  setDataTypes(dataTypes: DataType[]) {
    this.dataTypes = dataTypes;
    this.sort();
  }

  create(data: Pick<DataType, 'name' | 'primitiveType'>) {
    return new Promise(resolve => {
      createDataType(data).subscribe(key => {
        const subscription = openIndexedDB
          .pipe(findOne(key, 'dataType'))
          .subscribe(([dataType]) => {
            runInAction(() => {
              this.dataTypes.push(dataType);
              resolve(dataType);
            });
            subscription.unsubscribe();
          });
      });
    });
  }

  update(data: Pick<DataType, 'name' | 'primitiveType' | 'uuid'>) {
    updateByDataTypeUUID(data).subscribe(key => {
      const dataType = this.dataTypes.find(dataType => dataType.uuid === key);
      if (!dataType) return;

      runInAction(() => {
        dataType.name = data.name;
        dataType.primitiveType = data.primitiveType;
      });
    });
  }

  delete(uuid: string) {
    deleteByDataTypeUUID(uuid).subscribe(old => {
      this.setDataTypes(
        this.dataTypes.filter(dataType => dataType.uuid !== old.uuid)
      );
    });
  }

  fetch() {
    return new Promise(resolve => {
      findDataTypes.subscribe({
        next: dataTypes => {
          if (dataTypes.length) {
            this.setDataTypes(dataTypes);
          } else {
            defaultDataTypes.forEach(data => this.create(data));
          }
        },
        complete: () => resolve(null),
      });
    });
  }

  sort() {
    this.dataTypes.sort(orderByNameASC);
  }
}
