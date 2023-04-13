import { ActionMap as TableActionMap } from '@/engine/modules/table/actions';
import { ActionMap as TableColumnActionMap } from '@/engine/modules/tableColumn/actions';

export type RootActionMap = TableActionMap & TableColumnActionMap;
