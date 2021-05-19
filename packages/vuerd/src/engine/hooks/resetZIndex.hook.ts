import { CommandKey, CommandTypeAll } from '@@types/engine/command';
import { State } from '@@types/engine/store';
import { Helper } from '@@types/core/helper';
import { Observable, Subscription } from 'rxjs';
import { commandsFilter } from '@/core/operators/commandsFilter';

const hookKeys: CommandKey[] = ['editor.loadJson', 'editor.initLoadJson'];

export const useResetZIndex = (
  hook$: Observable<Array<CommandTypeAll>>,
  { tableState: { tables }, memoState: { memos } }: State,
  helper: Helper
): Subscription =>
  hook$.pipe(commandsFilter(hookKeys)).subscribe(() => {
    const uiList = [
      ...tables.map(table => table.ui),
      ...memos.map(memo => memo.ui),
    ];

    uiList.sort((a, b) => a.zIndex - b.zIndex);
    uiList.forEach((ui, index) => (ui.zIndex = index + 1));
  });
