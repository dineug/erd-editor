import { GeneratorAction } from '@/engine/generator.actions';
import {
  selectAction,
  unselectAllAction,
} from '@/engine/modules/editor/atom.actions';
import { SelectType } from '@/engine/modules/editor/state';
import { nextPoint, nextZIndex, uuid } from '@/utils';
import { query } from '@/utils/collection/query';

import {
  addMemoAction,
  changeZIndexAction,
  removeMemoAction,
} from './atom.actions';

export const addMemoAction$ = (): GeneratorAction =>
  function* ({ settings, doc: { tableIds, memoIds }, collections }) {
    const tables = query(collections)
      .collection('tableEntities')
      .selectByIds(tableIds);
    const memos = query(collections)
      .collection('memoEntities')
      .selectByIds(memoIds);
    const point = nextPoint(settings, tables, memos);
    const id = uuid();

    yield unselectAllAction();
    yield selectAction({ [id]: SelectType.memo });
    // TODO: focus table end
    yield addMemoAction({
      id,
      ui: {
        x: point.x,
        y: point.y,
        zIndex: nextZIndex(tables, memos),
      },
    });
  };

export const removeMemoAction$ = (id?: string): GeneratorAction =>
  function* ({ editor: { selectedMap } }) {
    if (id) {
      yield removeMemoAction({ id });
      return;
    }

    const selectedMemos = Object.entries(selectedMap).filter(
      ([, type]) => type === SelectType.memo
    );
    for (const [id] of selectedMemos) {
      yield removeMemoAction({ id });
    }
  };

export const selectMemoAction$ = (id: string, $mod: boolean): GeneratorAction =>
  function* ({ doc: { tableIds, memoIds }, collections }) {
    const tables = query(collections)
      .collection('tableEntities')
      .selectByIds(tableIds);
    const memos = query(collections)
      .collection('memoEntities')
      .selectByIds(memoIds);

    if (!$mod) {
      yield unselectAllAction();
    }
    yield selectAction({ [id]: SelectType.memo });
    yield changeZIndexAction({ id, zIndex: nextZIndex(tables, memos) });
  };

export const actions$ = {
  addMemoAction$,
  removeMemoAction$,
  selectMemoAction$,
};
