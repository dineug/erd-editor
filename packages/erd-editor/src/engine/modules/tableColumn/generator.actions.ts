import { GeneratorAction } from '@/engine/generator.actions';
import { SelectType } from '@/engine/modules/editor/state';
import { uuid } from '@/utils';

import { addColumnAction, removeColumnAction } from './atom.actions';

export const addColumnAction$ = (tableId?: string): GeneratorAction =>
  function* ({ editor: { selectedMap } }) {
    if (tableId) {
      yield addColumnAction({
        id: uuid(),
        tableId,
      });
      return;
    }

    const selectedTables = Object.entries(selectedMap).filter(
      ([, type]) => type === SelectType.table
    );

    for (const [tableId] of selectedTables) {
      yield addColumnAction({
        id: uuid(),
        tableId,
      });
    }
  };

export const removeColumnAction$ = (
  tableId: string,
  columnIds: string[]
): GeneratorAction =>
  function* () {
    // TODO: valid index, relationship

    for (const columnId of columnIds) {
      yield removeColumnAction({
        id: columnId,
        tableId,
      });
    }
  };

export const actions$ = {
  addColumnAction$,
  removeColumnAction$,
};
