import { Observable, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import { commandsFilter } from '@/core/operators/commandsFilter';
import { relationshipSort } from '@/engine/store/helper/relationship.helper';
import { recalculatingTableWidth } from '@/engine/store/helper/table.helper';
import { Helper } from '@@types/core/helper';
import { CommandKey, CommandTypeAll } from '@@types/engine/command';
import { State } from '@@types/engine/store';

const hookKeys: CommandKey[] = ['editor.loadJson', 'editor.initLoadJson'];

export const useRecalculatingTableWidth = (
  hook$: Observable<Array<CommandTypeAll>>,
  { tableState: { tables }, relationshipState: { relationships } }: State,
  helper: Helper
): Subscription =>
  hook$.pipe(commandsFilter(hookKeys), debounceTime(1000)).subscribe(() => {
    recalculatingTableWidth(tables, helper);
    relationshipSort(tables, relationships);
  });
