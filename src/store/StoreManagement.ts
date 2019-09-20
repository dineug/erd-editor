import {
  Commit as CanvasCommit,
  State as CanvasState,
  createStore as createdStoreCanvas,
} from './canvas';
import {
  Commit as TableCommit,
  State as TableState,
  createStore as createdStoreTable,
} from './table';
import {
  Commit as MemoCommit,
  State as MemoState,
  createStore as createdStoreMemo,
} from './memo';
import EventBus from '@/ts/EventBus';
import {log} from '@/ts/util';
import {Store} from 'vuex';

function setData(exclude: string, target: any, data: any) {
  Object.keys(data).forEach((key) => {
    if (key !== exclude) {
      if (data[key] === null || data[key] === undefined) {
        target[key] = data[key];
      } else if (Array.isArray(data[key])) {
        target[key] = [];
        data[key].forEach((value: any) => {
          const v = {};
          setData(exclude, v, value);
          target[key].push(v);
        });
      } else if (typeof data[key] === 'object') {
        target[key] = {};
        setData(exclude, target[key], data[key]);
      } else {
        target[key] = data[key];
      }
    }
  });
}

export default class StoreManagement {
  public readonly canvasStore: Store<CanvasState>;
  public readonly tableStore: Store<TableState>;
  public readonly memoStore: Store<MemoState>;
  public readonly eventBus: EventBus;

  constructor() {
    this.canvasStore = createdStoreCanvas();
    this.tableStore = createdStoreTable();
    this.memoStore = createdStoreMemo();
    this.eventBus = new EventBus();
  }

  public init() {
    log.debug('DataManagement init');
    this.canvasStore.commit(CanvasCommit.init);
    this.tableStore.commit(TableCommit.init);
    this.memoStore.commit(MemoCommit.init);
  }

  public load(value: string) {
    log.debug('DataManagement load');
    const data = JSON.parse(value);
    this.canvasStore.commit(CanvasCommit.load, data.canvas);
    this.tableStore.commit(TableCommit.load, {
      load: data.table,
      store: this,
    });
    this.memoStore.commit(MemoCommit.load, data.memo);
  }

  get value(): string {
    log.debug('DataManagement value');
    const data = {
      canvas: this.canvasStore.state,
      table: {},
      memo: {},
    };
    setData('store', data.table, this.tableStore.state);
    setData('store', data.memo, this.memoStore.state);
    return JSON.stringify(data);
  }
}
