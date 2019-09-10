import {State, Table} from '../table';
import TableModel from '@/models/TableModel';
import {log} from '@/ts/util';

export function tableAdd(state: State) {
  log.debug('tableController tableAdd');
  state.tables.push(new TableModel());
}

export function tableMove(state: State, payload: {table: Table, x: number, y: number}) {
  log.debug('tableController tableMove');
  const {table, x, y} = payload;
  table.ui.top += y;
  table.ui.left += x;
}
