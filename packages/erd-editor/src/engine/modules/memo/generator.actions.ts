import { query } from '@dineug/erd-editor-schema';
import { uuid25 } from '@dineug/uuid';

import { GeneratorAction } from '@/engine/generator.actions';
import { selectAction } from '@/engine/modules/editor/atom.actions';
import { unselectAllAction$ } from '@/engine/modules/editor/generator.actions';
import { SelectType } from '@/engine/modules/editor/state';
import { nextPoint, nextZIndex } from '@/utils';
import { arrayHas } from '@/utils/arrayHas';

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
    const id = uuid25();

    yield unselectAllAction$();
    yield selectAction({ [id]: SelectType.memo });
    yield addMemoAction({
      id,
      ui: {
        ...point,
        zIndex: nextZIndex(tables, memos),
      },
    });
  };

export const removeMemoAction$ = (id?: string): GeneratorAction =>
  function* ({ doc: { memoIds }, editor: { selectedMap } }) {
    if (id) {
      yield removeMemoAction({ id });
      return;
    }

    // A memo a peer, an agent or an undo removes stays selected, and its
    // removal recorded again would make an undo that brings it back.
    const isInDoc = arrayHas(memoIds);
    const selectedMemos = Object.entries(selectedMap).filter(
      ([id, type]) => type === SelectType.memo && isInDoc(id)
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
      yield unselectAllAction$();
    }
    yield selectAction({ [id]: SelectType.memo });
    yield changeZIndexAction({ id, zIndex: nextZIndex(tables, memos) });
  };

export const actions$ = {
  addMemoAction$,
  removeMemoAction$,
  selectMemoAction$,
};
