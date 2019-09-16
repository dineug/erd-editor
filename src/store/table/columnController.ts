import {State, Table} from '../table';
import {log} from '@/ts/util';
import ColumnModel from '@/models/ColumnModel';

export function columnAdd(state: State, table: Table) {
  log.debug('columnController columnAdd');
  table.columns.push(new ColumnModel());
}
