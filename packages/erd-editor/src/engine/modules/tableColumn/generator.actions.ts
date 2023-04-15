import { GeneratorAction } from '@/engine/generator.actions';
import { SelectType } from '@/engine/modules/editor/state';
import { uuid } from '@/utils';

import { addColumnAction } from './atom.actions';

export const addColumn$ = (tableId?: string): GeneratorAction =>
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
