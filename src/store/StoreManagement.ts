import {
  Commit as CanvasCommit,
  State as CanvasState,
  createStore as createdStoreCanvas,
} from '@/store/canvas';
import {
  Commit as TableCommit,
  State as TableState,
  createStore as createdStoreTable,
} from '@/store/table';
import {
  Commit as MemoCommit,
  State as MemoState,
  createStore as createdStoreMemo,
} from '@/store/memo';
import {log} from '@/ts/util';
import {Store} from 'vuex';

function setData(exclude: string, target: any, data: any) {
  if (data !== null && data !== undefined) {
    Object.keys(data).forEach((key) => {
      if (key !== exclude) {
        if (Array.isArray(data[key])) {
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
}

export default class StoreManagement {
  private readonly storeCanvas: Store<CanvasState>;
  private readonly storeTable: Store<TableState>;
  private readonly storeMemo: Store<MemoState>;

  constructor() {
    this.storeCanvas = createdStoreCanvas();
    this.storeTable = createdStoreTable();
    this.storeMemo = createdStoreMemo();
  }

  get canvasStore(): Store<CanvasState> {
    return this.storeCanvas;
  }

  get tableStore(): Store<TableState> {
    return this.storeTable;
  }

  get memoStore(): Store<MemoState> {
    return this.storeMemo;
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

  public value(): string {
    log.debug('DataManagement value');
    const data = {
      canvas: this.storeCanvas.state,
      table: {},
      memo: {},
    };
    setData('store', data.table, this.storeTable.state);
    setData('store', data.memo, this.storeMemo.state);
    return JSON.stringify(data);
  }
}
