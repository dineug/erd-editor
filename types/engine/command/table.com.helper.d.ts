import { Store } from '../store';
import { CommandType } from './index';
import { Point } from '../store/relationship.helper';
import { PureTable } from '../store/table.state';
import { Helper } from '../../core/helper';

export * from './table.cmd.helper.gen';

export declare function addTable(
  store: Store,
  active?: boolean
): CommandType<'table.add'>;

export declare function moveTable(
  store: Store,
  ctrlKey: boolean,
  movementX: number,
  movementY: number,
  tableId: string
): CommandType<'table.move'>;

export declare function removeTable(
  store: Store,
  tableId?: string
): CommandType<'table.remove'>;

export declare function selectTable(
  store: Store,
  ctrlKey: boolean,
  tableId: string
): CommandType<'table.select'>;

export declare function selectEndTable(): CommandType<'table.selectEnd'>;

export declare function selectAllTable(): CommandType<'table.selectAll'>;

export declare function selectOnlyTable(
  store: Store,
  tableId: string
): CommandType<'table.selectOnly'>;

export declare function changeTableName(
  helper: Helper,
  tableId: string,
  value: string
): CommandType<'table.changeName'>;

export declare function changeTableComment(
  helper: Helper,
  tableId: string,
  value: string
): CommandType<'table.changeComment'>;

export declare function dragSelectTable(
  min: Point,
  max: Point
): CommandType<'table.dragSelect'>;

export declare function sortTable(): CommandType<'table.sort'>;

export declare function loadTable(table: PureTable): CommandType<'table.load'>;
