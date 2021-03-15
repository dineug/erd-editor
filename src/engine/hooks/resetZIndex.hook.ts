import { CommandKey } from '@@types/engine/command';
import { State } from '@@types/engine/store';

const hookKeys: CommandKey[] = ['editor.loadJson'];
const match = new RegExp(hookKeys.join('|'), 'i');

export function useResetZIndex(
  { tableState: { tables }, memoState: { memos } }: State,
  commandName: CommandKey
) {
  if (!match.test(commandName)) return;

  const uiList = [
    ...tables.map(table => table.ui),
    ...memos.map(memo => memo.ui),
  ];

  uiList.sort((a, b) => a.zIndex - b.zIndex);
  uiList.forEach((ui, index) => (ui.zIndex = index + 1));
}
