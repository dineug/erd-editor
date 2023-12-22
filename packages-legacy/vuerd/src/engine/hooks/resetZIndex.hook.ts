import { Observable, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import { commandsFilter } from '@/core/operators/commandsFilter';
import { Helper } from '@@types/core/helper';
import { CommandKey, CommandTypeAll } from '@@types/engine/command';
import { State } from '@@types/engine/store';

const hookKeys: CommandKey[] = ['editor.loadJson', 'editor.initLoadJson'];

export const useResetZIndex = (
  hook$: Observable<Array<CommandTypeAll>>,
  { tableState: { tables }, memoState: { memos } }: State,
  helper: Helper
): Subscription =>
  hook$.pipe(commandsFilter(hookKeys), debounceTime(1000)).subscribe(() => {
    const uiList = [
      ...tables.map(table => table.ui),
      ...memos.map(memo => memo.ui),
    ];

    uiList.sort((a, b) => a.zIndex - b.zIndex);
    uiList.forEach((ui, index) => (ui.zIndex = index + 1));
  });
