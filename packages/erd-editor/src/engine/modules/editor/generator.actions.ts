import { isEmpty } from 'lodash-es';

import { GeneratorAction } from '@/engine/generator.actions';
import {
  clearAction,
  focusTableEndAction,
  loadJsonAction,
  selectAction,
  unselectAllAction,
} from '@/engine/modules/editor/atom.actions';
import { SelectType } from '@/engine/modules/editor/state';
import { moveMemoAction } from '@/engine/modules/memo/atom.actions';
import { removeMemoAction$ } from '@/engine/modules/memo/generator.actions';
import { moveTableAction } from '@/engine/modules/table/atom.actions';
import { removeTableAction$ } from '@/engine/modules/table/generator.actions';
import { Point } from '@/internal-types';
import { calcMemoHeight, calcMemoWidth } from '@/utils/calcMemo';
import { calcTableHeight, calcTableWidths } from '@/utils/calcTable';
import { query } from '@/utils/collection/query';

type SelectTypeIds = {
  tableIds: string[];
  memoIds: string[];
};

function getSelectTypeIds(
  selectedMap: Record<string, SelectType>
): SelectTypeIds {
  return Object.entries(selectedMap).reduce<SelectTypeIds>(
    (acc, [id, type]) => {
      if (type === SelectType.table) {
        acc.tableIds.push(id);
      } else if (type === SelectType.memo) {
        acc.memoIds.push(id);
      }

      return acc;
    },
    { tableIds: [], memoIds: [] }
  );
}

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
    const { tableIds, memoIds } = getSelectTypeIds(selectedMap);
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

export const dragSelectAction$ = (min: Point, max: Point): GeneratorAction =>
  function* (state) {
    const {
      doc: { tableIds, memoIds },
      collections,
    } = state;

    const inRange = (x: number, y: number) =>
      min.x <= x && max.x >= x && min.y <= y && max.y >= y;

    const selectedMap: Record<string, SelectType> = {
      ...query(collections)
        .collection('tableEntities')
        .selectByIds(tableIds)
        .reduce<Record<string, SelectType>>((acc, table) => {
          const width = calcTableWidths(table, state).width;
          const height = calcTableHeight(table);
          const centerX = table.ui.x + width / 2;
          const centerY = table.ui.y + height / 2;

          if (inRange(centerX, centerY)) {
            acc[table.id] = SelectType.table;
          }

          return acc;
        }, {}),
      ...query(collections)
        .collection('memoEntities')
        .selectByIds(memoIds)
        .reduce<Record<string, SelectType>>((acc, memo) => {
          const width = calcMemoWidth(memo);
          const height = calcMemoHeight(memo);
          const centerX = memo.ui.x + width / 2;
          const centerY = memo.ui.y + height / 2;

          if (inRange(centerX, centerY)) {
            acc[memo.id] = SelectType.memo;
          }

          return acc;
        }, {}),
    };

    yield unselectAllAction$();

    if (!isEmpty(selectedMap)) {
      yield selectAction(selectedMap);
    }
  };

export const unselectAllAction$ = (): GeneratorAction =>
  function* () {
    yield unselectAllAction();
    yield focusTableEndAction();
  };

export const actions$ = {
  loadJsonAction$,
  moveAllAction$,
  removeSelectedAction$,
  dragSelectAction$,
};
