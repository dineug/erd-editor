import canvasStore, {Commit} from '@/store/canvas';
import tableStore, {Commit as TableCommit} from '@/store/table';
import memoStore, {Commit as MemoCommit} from '@/store/memo';
import {log} from '@/ts/util';

export default class DataManagement {

  public static init() {
    log.debug('DataManagement init');
    canvasStore.commit(Commit.init);
    tableStore.commit(TableCommit.init);
    memoStore.commit(MemoCommit.init);
  }

  public static load(value: string) {
    log.debug('DataManagement load');
    const data = JSON.parse(value);
    canvasStore.commit(Commit.load, data.canvas);
    tableStore.commit(TableCommit.load, data.table);
    memoStore.commit(MemoCommit.load, data.memo);
  }

  public static value(): string {
    log.debug('DataManagement value');
    const data = {
      canvas: canvasStore.state,
      table: tableStore.state,
      memo: memoStore.state,
    };
    return JSON.stringify(data);
  }
}
