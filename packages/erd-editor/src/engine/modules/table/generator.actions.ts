import { GeneratorAction } from '@/engine/generator.actions';
import {
  selectAction,
  unselectAllAction,
} from '@/engine/modules/editor/atom.actions';
import { SelectType } from '@/engine/modules/editor/state';
import { nextPoint, nextZIndex, uuid } from '@/utils';
import { query } from '@/utils/collection/query';

import {
  addTableAction,
  changeZIndexAction,
  removeTableAction,
} from './atom.actions';

export const addTableAction$ = (): GeneratorAction =>
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
    yield selectAction({ [id]: SelectType.table });
    yield addTableAction({
      id,
      ui: {
        x: point.x,
        y: point.y,
        zIndex: nextZIndex(tables, memos),
      },
    });
    // TODO: focus table
  };

export const removeTableAction$ = (id?: string): GeneratorAction =>
  function* ({ editor: { selectedMap } }) {
    if (id) {
      yield removeTableAction({ id });
      return;
    }

    const selectedTables = Object.entries(selectedMap).filter(
      ([, type]) => type === SelectType.table
    );
    for (const [id] of selectedTables) {
      yield removeTableAction({ id });
    }
  };

export const selectTableAction$ = (
  id: string,
  $mod: boolean
): GeneratorAction =>
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
    yield selectAction({ [id]: SelectType.table });
    yield changeZIndexAction({ id, zIndex: nextZIndex(tables, memos) });

    // TODO: focusTable, drawRelationship
  };

export const actions$ = {
  addTableAction$,
  removeTableAction$,
  selectTableAction$,
};
