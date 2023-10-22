import { GeneratorAction } from '@/engine/generator.actions';
import {
  clearAction,
  loadJsonAction,
} from '@/engine/modules/editor/atom.actions';
import { SelectType } from '@/engine/modules/editor/state';
import { moveMemoAction } from '@/engine/modules/memo/atom.actions';
import { removeMemoAction$ } from '@/engine/modules/memo/generator.actions';
import { moveTableAction } from '@/engine/modules/table/atom.actions';
import { removeTableAction$ } from '@/engine/modules/table/generator.actions';

export const loadJsonAction$ = (value: string): GeneratorAction =>
  function* () {
    yield clearAction();
    yield loadJsonAction({ value });
  };

export const moveAllAction$ = (
  movementX: number,
  movementY: number
): GeneratorAction =>
  function* ({ editor: { selectedMap }, settings: { zoomLevel } }) {
    const { tableIds, memoIds } = Object.entries(selectedMap).reduce(
      (acc, [id, type]) => {
        if (type === SelectType.table) {
          acc.tableIds.push(id);
        } else if (type === SelectType.memo) {
          acc.memoIds.push(id);
        }

        return acc;
      },
      {
        tableIds: [] as string[],
        memoIds: [] as string[],
      }
    );

    const newMovementX = movementX / zoomLevel;
    const newMovementY = movementY / zoomLevel;

    if (tableIds.length) {
      yield moveTableAction({
        ids: tableIds,
        movementX: newMovementX,
        movementY: newMovementY,
      });
    }

    if (memoIds.length) {
      yield moveMemoAction({
        ids: memoIds,
        movementX: newMovementX,
        movementY: newMovementY,
      });
    }
  };

export const removeSelectedAction$ = (): GeneratorAction =>
  function* () {
    yield removeTableAction$();
    yield removeMemoAction$();
  };

export const actions$ = {
  loadJsonAction$,
  moveAllAction$,
  removeSelectedAction$,
};
