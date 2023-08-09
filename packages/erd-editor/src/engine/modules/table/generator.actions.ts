import { GeneratorAction } from '@/engine/generator.actions';
import { nextPoint, nextZIndex, uuid } from '@/utils';
import { query } from '@/utils/collection/query';

import { addTableAction } from './atom.actions';

export const addTableAction$ = (): GeneratorAction =>
  function* ({ settings, doc: { tableIds, memoIds }, collections }) {
    const tables = query(collections)
      .collection('tableEntities')
      .selectByIds(tableIds);
    const memos = query(collections)
      .collection('memoEntities')
      .selectByIds(memoIds);
    const point = nextPoint(settings, tables, memos);

    yield addTableAction({
      id: uuid(),
      ui: {
        x: point.x,
        y: point.y,
        zIndex: nextZIndex(tables, memos),
      },
    });
  };

export const actions$ = {
  addTableAction$,
};
