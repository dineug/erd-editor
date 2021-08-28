import { makeAutoObservable, runInAction } from 'mobx';

import {
  createDataType,
  DataType,
  deleteByDataTypeUUID,
  findDataTypes,
  openIndexedDB,
  updateByDataTypeUUID,
} from '@/core/indexedDB';
import { findOne } from '@/core/indexedDB/operators/findOne';

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
    createDataType(data).subscribe(key => {
      const subscription = openIndexedDB
        .pipe(findOne(key, 'dataType'))
        .subscribe(([dataType]) => {
          runInAction(() => {
            this.dataTypes.push(dataType);
          });
          subscription.unsubscribe();
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
    findDataTypes.subscribe(dataTypes => {
      // TODO: create exampleTemplates
      // templates.length === 0

      this.setDataTypes(dataTypes);
    });
  }

  sort() {
    this.dataTypes.sort((a, b) => {
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();
      if (nameA < nameB) {
        return -1;
      } else if (nameA > nameB) {
        return 1;
      }
      return 0;
    });
  }
}
