import { Index, OrderType } from '../store/table.state';
import { CommandType } from './index';

export function addIndex(tableId: string): CommandType<'index.add'>;

export function removeIndex(indexIds: string[]): CommandType<'index.remove'>;

export function changeIndexName(
  indexId: string,
  value: string
): CommandType<'index.changeName'>;

export function changeIndexUnique(
  indexId: string,
  value: boolean
): CommandType<'index.changeUnique'>;

export function addIndexColumn(
  indexId: string,
  columnId: string
): CommandType<'index.addColumn'>;

export function removeIndexColumn(
  indexId: string,
  columnId: string
): CommandType<'index.removeColumn'>;

export function moveIndexColumn(
  indexId: string,
  columnId: string,
  targetColumnId: string
): CommandType<'index.moveColumn'>;

export function changeIndexColumnOrderType(
  indexId: string,
  columnId: string,
  value: OrderType
): CommandType<'index.changeColumnOrderType'>;

export function loadIndex(index: Index): CommandType<'index.load'>;
