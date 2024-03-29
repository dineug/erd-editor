import { query } from '@dineug/erd-editor-schema';
import { nanoid } from '@dineug/shared';

import { GeneratorAction } from '@/engine/generator.actions';

import { addIndexAction, changeIndexUniqueAction } from './atom.actions';

export const addIndexAction$ = (tableId: string): GeneratorAction =>
  function* () {
    yield addIndexAction({
      id: nanoid(),
      tableId,
    });
  };

export const changeIndexUniqueAction$ = (indexId: string): GeneratorAction =>
  function* ({ collections }) {
    const index = query(collections)
      .collection('indexEntities')
      .selectById(indexId);
    if (!index) return;

    yield changeIndexUniqueAction({
      id: indexId,
      tableId: index.tableId,
      value: !index.unique,
    });
  };

export const actions$ = {
  addIndexAction$,
  changeIndexUniqueAction$,
};
