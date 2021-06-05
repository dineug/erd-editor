import { Observable, Subscription } from 'rxjs';

import { commandsFilter } from '@/core/operators/commandsFilter';
import { relationshipSort } from '@/engine/store/helper/relationship.helper';
import { Helper } from '@@types/core/helper';
import { CommandKey, CommandTypeAll } from '@@types/engine/command';
import { State } from '@@types/engine/store';

const hookKeys: CommandKey[] = [
  'canvas.changeShow',
  'relationship.add',
  'memo.move',
  'table.move',
  'table.changeName',
  'table.changeComment',
  'table.sort',
  'column.add',
  'column.addCustom',
  'column.remove',
  'column.changeName',
  'column.changeComment',
  'column.changeDataType',
  'column.changeDefault',
  'column.move',
  'editor.loadJson',
  'editor.initLoadJson',
];

export const useRelationshipSort = (
  hook$: Observable<Array<CommandTypeAll>>,
  { tableState: { tables }, relationshipState: { relationships } }: State,
  helper: Helper
): Subscription =>
  hook$
    .pipe(commandsFilter(hookKeys))
    .subscribe(() => relationshipSort(tables, relationships));
